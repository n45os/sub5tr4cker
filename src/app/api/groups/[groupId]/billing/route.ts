import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IGroupMember, IMemberPayment } from "@/models";
import {
  filterBillingForMember,
  getGroupAccess,
  getMemberEntry,
} from "@/lib/authorization";
import { calculateShares } from "@/lib/billing/calculator";
import { createConfirmationToken } from "@/lib/tokens";

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
  if (!mongoose.isValidObjectId(groupId)) {
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

  await dbConnect();

  const group = await Group.findById(groupId);
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
  if (!memberEntry) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not authorized to view this group" } },
      { status: 403 }
    );
  }

  const effectiveMemberId =
    access === "member" ? memberEntry._id.toString() : memberIdFilter;

  const query: Record<string, unknown> = { group: groupId };
  if (statusFilter) {
    query["payments.status"] = statusFilter;
  }
  if (effectiveMemberId && mongoose.isValidObjectId(effectiveMemberId)) {
    query["payments.memberId"] = effectiveMemberId;
  }

  const total = await BillingPeriod.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const periods = await BillingPeriod.find(query)
    .sort({ periodStart: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
    .exec();

  type PeriodDoc = {
    _id: { toString: () => string };
    periodStart: Date;
    periodLabel: string;
    totalPrice: number;
    payments: Array<{
      memberId: { toString: () => string };
      memberNickname: string;
      amount: number;
      status: string;
      memberConfirmedAt: Date | null;
      adminConfirmedAt: Date | null;
    }>;
    isFullyPaid: boolean;
  };
  const allPeriods = periods as PeriodDoc[];
  const list = access === "member"
    ? filterBillingForMember(allPeriods, memberEntry._id.toString())
    : allPeriods.map((p) => {
    const payments = p.payments.map((pay) => ({
      memberId: pay.memberId.toString(),
      memberNickname: pay.memberNickname,
      amount: pay.amount,
      status: pay.status,
      memberConfirmedAt: pay.memberConfirmedAt
        ? (pay.memberConfirmedAt as Date).toISOString()
        : null,
      adminConfirmedAt: pay.adminConfirmedAt
        ? (pay.adminConfirmedAt as Date).toISOString()
        : null,
    }));
    const filteredPayments = effectiveMemberId
      ? payments.filter((pay) => pay.memberId === effectiveMemberId)
      : payments;
    return {
      _id: p._id.toString(),
      periodStart: (p.periodStart as Date).toISOString().slice(0, 10),
      periodLabel: p.periodLabel,
      totalPrice: p.totalPrice,
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
  if (!mongoose.isValidObjectId(groupId)) {
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

  await dbConnect();

  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can create billing periods" } },
      { status: 403 }
    );
  }

  const periodStart = parseDate(parsed.data.periodStart);
  const periodEnd = parseDate(parsed.data.periodEnd);
  const totalPrice = parsed.data.totalPrice;
  const periodLabel = parsed.data.periodLabel;

  const existing = await BillingPeriod.findOne({
    group: groupId,
    periodStart,
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "A billing period already exists for this start date" } },
      { status: 409 }
    );
  }

  const shares = calculateShares(group, totalPrice, periodStart);
  if (shares.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Group has no active members to split payment for this period" } },
      { status: 400 }
    );
  }

  const payments = await Promise.all(
    shares.map(async (share) => ({
      memberId: share.memberId,
      memberEmail: share.email,
      memberNickname: share.nickname,
      amount: share.amount,
      status: "pending" as const,
      confirmationToken: await createConfirmationToken(
        share.memberId,
        "", // periodId filled after create
        groupId
      ),
    }))
  );

  const period = await BillingPeriod.create({
    group: groupId,
    periodStart,
    periodEnd,
    periodLabel,
    totalPrice,
    currency: group.billing.currency,
    payments,
  });

  for (const payment of period.payments) {
    payment.confirmationToken = await createConfirmationToken(
      payment.memberId.toString(),
      period._id.toString(),
      groupId
    );
  }
  await period.save();

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "billing_period_created",
    groupId,
    billingPeriodId: period._id.toString(),
    metadata: {
      periodLabel: period.periodLabel,
      totalPrice: period.totalPrice,
    },
  });

  return NextResponse.json({
    data: {
      _id: period._id.toString(),
      periodLabel: period.periodLabel,
      periodStart: period.periodStart.toISOString().slice(0, 10),
      periodEnd: period.periodEnd.toISOString().slice(0, 10),
      totalPrice: period.totalPrice,
      currency: period.currency,
      payments: period.payments.map((p: IMemberPayment) => ({
        memberId: p.memberId.toString(),
        memberNickname: p.memberNickname,
        amount: p.amount,
        status: p.status,
      })),
    },
  });
}
