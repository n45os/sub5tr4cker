import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { recalculateSinglePeriodFromGroupRules } from "@/lib/billing/backfill";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IMemberPayment } from "@/models";

function serializePayments(period: { payments: IMemberPayment[] }) {
  return period.payments.map((p: IMemberPayment) => ({
    memberId: p.memberId.toString(),
    memberNickname: p.memberNickname,
    amount: p.amount,
    adjustedAmount: p.adjustedAmount ?? null,
    adjustmentReason: p.adjustmentReason ?? null,
    status: p.status,
    notes: p.notes ?? null,
    memberConfirmedAt: p.memberConfirmedAt
      ? (p.memberConfirmedAt as Date).toISOString()
      : null,
    adminConfirmedAt: p.adminConfirmedAt
      ? (p.adminConfirmedAt as Date).toISOString()
      : null,
  }));
}

// admin-only: apply equal_split / variable math for this period only (drops orphan rows, syncs amounts)
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ groupId: string; periodId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 },
    );
  }

  const { groupId, periodId } = await context.params;
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(periodId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid id" } },
      { status: 400 },
    );
  }

  await dbConnect();
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 },
    );
  }

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can recalculate" } },
      { status: 403 },
    );
  }

  if (
    group.billing.mode !== "equal_split" &&
    group.billing.mode !== "variable"
  ) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Recalculate applies to equal split and variable billing only",
        },
      },
      { status: 400 },
    );
  }

  const period = await BillingPeriod.findOne({
    _id: periodId,
    group: groupId,
  });
  if (!period) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Billing period not found" } },
      { status: 404 },
    );
  }

  recalculateSinglePeriodFromGroupRules(group, period);

  period.isFullyPaid = period.payments.every(
    (p: IMemberPayment) => p.status === "confirmed" || p.status === "waived",
  );
  await period.save();

  return NextResponse.json({
    data: {
      _id: period._id.toString(),
      periodLabel: period.periodLabel,
      totalPrice: period.totalPrice,
      currency: period.currency,
      priceNote: period.priceNote,
      payments: serializePayments(period),
      isFullyPaid: period.isFullyPaid,
    },
  });
}
