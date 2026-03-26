import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { getCollectionOpensAt } from "@/lib/billing/collection-window";
import { db, isStorageId, type StorageGroupMember, type StorageMemberPayment } from "@/lib/storage";

const importPeriodSchema = z.object({
  periodLabel: z.string().min(1).max(50),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  totalPrice: z.number().positive(),
  payments: z.array(
    z.object({
      memberEmail: z.string().email(),
      amount: z.number().min(0),
      status: z.enum(["confirmed", "pending", "waived"]),
    })
  ),
});

const importSchema = z.object({
  periods: z.array(importPeriodSchema).min(1).max(60),
});

function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00.000Z");
  return new Date(s);
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

  const parsed = importSchema.safeParse(await request.json());
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
      { error: { code: "FORBIDDEN", message: "Only the admin can import billing history" } },
      { status: 403 }
    );
  }

  const results: Array<{
    periodLabel: string;
    status: "created" | "skipped";
    reason?: string;
  }> = [];

  for (const periodData of parsed.data.periods) {
    const periodStart = parseDate(periodData.periodStart);

    const existing = await store.getBillingPeriodByStart(groupId, periodStart);
    if (existing) {
      results.push({
        periodLabel: periodData.periodLabel,
        status: "skipped",
        reason: "period already exists for this start date",
      });
      continue;
    }

    const payments: StorageMemberPayment[] = [];
    for (const p of periodData.payments) {
      const member = group.members.find(
        (m: StorageGroupMember) => m.email.toLowerCase() === p.memberEmail.toLowerCase()
      );
      if (!member) continue;
      payments.push({
        id: nanoid(),
        memberId: member.id,
        memberEmail: member.email,
        memberNickname: member.nickname,
        amount: p.amount,
        adjustedAmount: null,
        adjustmentReason: null,
        status: p.status,
        memberConfirmedAt: null,
        adminConfirmedAt: p.status === "confirmed" ? new Date() : null,
        confirmationToken: null,
        notes: null,
      });
    }

    const isFullyPaid = payments.every(
      (p) => p.status === "confirmed" || p.status === "waived"
    );

    const collectionOpensAt = getCollectionOpensAt(
      periodStart,
      group.billing.paymentInAdvanceDays ?? 0
    );

    await store.createBillingPeriod({
      groupId,
      periodStart,
      collectionOpensAt,
      periodEnd: parseDate(periodData.periodEnd),
      periodLabel: periodData.periodLabel,
      totalPrice: periodData.totalPrice,
      currency: group.billing.currency,
      priceNote: null,
      payments,
      reminders: [],
      isFullyPaid,
    });

    results.push({ periodLabel: periodData.periodLabel, status: "created" });
  }

  return NextResponse.json({
    data: {
      imported: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      details: results,
    },
  });
}
