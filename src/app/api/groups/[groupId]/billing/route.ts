import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
  filterBillingForMember,
  getGroupAccess,
  getMemberEntry,
} from "@/lib/authorization";
import { calculateShares } from "@/lib/billing/calculator";
import { getCollectionOpensAt } from "@/lib/billing/collection-window";
import { findExistingPeriodForMonth } from "@/lib/billing/periods";
import { createConfirmationToken } from "@/lib/tokens";
import { db, isStorageId, type StorageBillingPeriod } from "@/lib/storage";

const createPeriodSchema = z.object({
  periodLabel: z.string().min(1).max(50),
  totalPrice: z.number().positive(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00.000Z");
  return new Date(s);
}

function memberLikeId(m: { id?: string; _id?: { toString(): string } }): string {
  if ("id" in m && m.id) return m.id;
  const oid = (m as { _id?: { toString(): string } })._id;
  return oid?.toString() ?? "";
}

function periodMatchesFilters(
  period: StorageBillingPeriod,
  statusFilter: string | undefined,
  effectiveMemberId: string | undefined
): boolean {
  if (statusFilter && !period.payments.some((pay) => pay.status === statusFilter)) {
    return false;
  }
  if (effectiveMemberId && !period.payments.some((pay) => pay.memberId === effectiveMemberId)) {
    return false;
  }
  return true;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  if (!isStorageId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));
  const statusFilter = searchParams.get("status") || undefined;
  const memberIdFilter = searchParams.get("memberId") || undefined;

  const store = await db();
  const group = await store.getGroup(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  const access = getGroupAccess(
    group,
    session.user.id,
    (session.user.email as string) || ""
  );
  if (!access) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not authorized to view this group" } },
      { status: 403 }
    );
  }

  const memberEntry = getMemberEntry(
    group,
    session.user.id,
    (session.user.email as string) || ""
  );
  if (access === "member" && !memberEntry) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not authorized to view this group" } },
      { status: 403 }
    );
  }

  const effectiveMemberId =
    access === "member" && memberEntry
      ? memberLikeId(memberEntry)
      : memberIdFilter && isStorageId(memberIdFilter)
        ? memberIdFilter
        : undefined;

  const allLoaded = await store.getPeriodsForGroup(groupId);
  const filtered = allLoaded.filter((p) =>
    periodMatchesFilters(p, statusFilter, effectiveMemberId)
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const slice = filtered.slice((page - 1) * limit, page * limit);

  if (access === "member" && effectiveMemberId) {
    const list = filterBillingForMember(slice, effectiveMemberId);
    return NextResponse.json({
      data: {
        periods: list,
        pagination: { page, totalPages, total },
      },
    });
  }

  const list = slice.map((p) => {
    const payments = p.payments.map((pay) => ({
      memberId: pay.memberId,
      memberNickname: pay.memberNickname,
      amount: pay.amount,
      adjustedAmount: pay.adjustedAmount ?? null,
      adjustmentReason: pay.adjustmentReason ?? null,
      status: pay.status,
      memberConfirmedAt: pay.memberConfirmedAt
        ? pay.memberConfirmedAt.toISOString()
        : null,
      adminConfirmedAt: pay.adminConfirmedAt
        ? pay.adminConfirmedAt.toISOString()
        : null,
    }));
    const filteredPayments = effectiveMemberId
      ? payments.filter((pay) => pay.memberId === effectiveMemberId)
      : payments;
    return {
      _id: p.id,
      periodStart: p.periodStart.toISOString().slice(0, 10),
      periodEnd: p.periodEnd.toISOString().slice(0, 10),
      periodLabel: p.periodLabel,
      totalPrice: p.totalPrice,
      priceNote: p.priceNote ?? null,
      payments: filteredPayments,
      isFullyPaid: p.isFullyPaid,
    };
  });

  return NextResponse.json({
    data: {
      periods: list,
      pagination: { page, totalPages, total },
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  if (!isStorageId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }

  const parsed = createPeriodSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const store = await db();
  const group = await store.getGroup(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.adminId !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can create billing periods" } },
      { status: 403 }
    );
  }

  const periodStart = parseDate(parsed.data.periodStart);
  const periodEnd = parseDate(parsed.data.periodEnd);
  const totalPrice = parsed.data.totalPrice;
  const periodLabel = parsed.data.periodLabel;

  const existingForMonth = await findExistingPeriodForMonth(
    store,
    groupId,
    periodStart.getUTCFullYear(),
    periodStart.getUTCMonth()
  );
  if (existingForMonth) {
    // idempotent: a period already covers this calendar month, so return it
    // instead of 409. emit a dedup audit when the candidate's exact instant
    // disagrees with the stored one — that signals a racing caller.
    if (existingForMonth.periodStart.getTime() !== periodStart.getTime()) {
      const actorName =
        (session.user.name as string) ||
        (session.user.email as string) ||
        "Unknown";
      await logAudit({
        actorId: session.user.id,
        actorName,
        action: "period_dedup_hit",
        groupId,
        billingPeriodId: existingForMonth.id,
        metadata: {
          source: "POST /api/groups/[groupId]/billing",
          candidatePeriodStart: periodStart.toISOString(),
          existingPeriodStart: existingForMonth.periodStart.toISOString(),
          year: periodStart.getUTCFullYear(),
          monthIndex: periodStart.getUTCMonth(),
        },
      });
    }
    return NextResponse.json({
      data: {
        _id: existingForMonth.id,
        periodLabel: existingForMonth.periodLabel,
        periodStart: existingForMonth.periodStart.toISOString().slice(0, 10),
        periodEnd: existingForMonth.periodEnd.toISOString().slice(0, 10),
        totalPrice: existingForMonth.totalPrice,
        currency: existingForMonth.currency,
        payments: existingForMonth.payments.map((p) => ({
          memberId: p.memberId,
          memberNickname: p.memberNickname,
          amount: p.amount,
          status: p.status,
        })),
      },
    });
  }

  const shares = calculateShares(group, totalPrice, periodStart);
  if (shares.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Group has no active members to split payment for this period",
        },
      },
      { status: 400 }
    );
  }

  const paymentRows = await Promise.all(
    shares.map(async (share) => ({
      id: nanoid(),
      memberId: share.memberId,
      memberEmail: share.email,
      memberNickname: share.nickname,
      amount: share.amount,
      adjustedAmount: null as number | null,
      adjustmentReason: null as string | null,
      status: "pending" as const,
      memberConfirmedAt: null as Date | null,
      adminConfirmedAt: null as Date | null,
      confirmationToken: await createConfirmationToken(share.memberId, "", groupId),
      notes: null as string | null,
    }))
  );

  const collectionOpensAt = getCollectionOpensAt(
    periodStart,
    group.billing.paymentInAdvanceDays ?? 0
  );

  const created = await store.createBillingPeriod({
    groupId,
    periodStart,
    collectionOpensAt,
    periodEnd,
    periodLabel,
    totalPrice,
    currency: group.billing.currency,
    priceNote: null,
    payments: paymentRows,
    reminders: [],
    isFullyPaid: false,
  });

  const paymentsWithTokens = await Promise.all(
    created.payments.map(async (payment) => ({
      ...payment,
      confirmationToken: await createConfirmationToken(
        payment.memberId,
        created.id,
        groupId
      ),
    }))
  );

  await store.updateBillingPeriod(created.id, { payments: paymentsWithTokens });

  const period = (await store.getBillingPeriod(created.id, groupId))!;

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "billing_period_created",
    groupId,
    billingPeriodId: period.id,
    metadata: {
      periodLabel: period.periodLabel,
      totalPrice: period.totalPrice,
    },
  });

  return NextResponse.json({
    data: {
      _id: period.id,
      periodLabel: period.periodLabel,
      periodStart: period.periodStart.toISOString().slice(0, 10),
      periodEnd: period.periodEnd.toISOString().slice(0, 10),
      totalPrice: period.totalPrice,
      currency: period.currency,
      payments: period.payments.map((p) => ({
        memberId: p.memberId,
        memberNickname: p.memberNickname,
        amount: p.amount,
        status: p.status,
      })),
    },
  });
}
