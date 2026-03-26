import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recalculateSinglePeriodFromGroupRules } from "@/lib/billing/backfill";
import { db, isStorageId, type StorageMemberPayment } from "@/lib/storage";

function serializePayments(period: { payments: StorageMemberPayment[] }) {
  return period.payments.map((p) => ({
    memberId: p.memberId,
    memberNickname: p.memberNickname,
    amount: p.amount,
    adjustedAmount: p.adjustedAmount ?? null,
    adjustmentReason: p.adjustmentReason ?? null,
    status: p.status,
    notes: p.notes ?? null,
    memberConfirmedAt: p.memberConfirmedAt ? p.memberConfirmedAt.toISOString() : null,
    adminConfirmedAt: p.adminConfirmedAt ? p.adminConfirmedAt.toISOString() : null,
  }));
}

// admin-only: apply equal_split / variable math for this period only (drops orphan rows, syncs amounts)
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ groupId: string; periodId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId, periodId } = await context.params;
  if (!isStorageId(groupId) || !isStorageId(periodId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid id" } },
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
      { error: { code: "FORBIDDEN", message: "Only the admin can recalculate" } },
      { status: 403 }
    );
  }

  if (group.billing.mode !== "equal_split" && group.billing.mode !== "variable") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Recalculate applies to equal split and variable billing only",
        },
      },
      { status: 400 }
    );
  }

  const loaded = await store.getBillingPeriod(periodId, groupId);
  if (!loaded) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Billing period not found" } },
      { status: 404 }
    );
  }

  const periodSlice = {
    payments: [...loaded.payments],
    totalPrice: loaded.totalPrice,
    periodStart: loaded.periodStart,
  };

  recalculateSinglePeriodFromGroupRules(group, periodSlice);

  const isFullyPaid = periodSlice.payments.every(
    (p: StorageMemberPayment) => p.status === "confirmed" || p.status === "waived"
  );

  const updated = await store.updateBillingPeriod(periodId, {
    payments: periodSlice.payments,
    isFullyPaid,
  });

  return NextResponse.json({
    data: {
      _id: updated.id,
      periodLabel: updated.periodLabel,
      totalPrice: updated.totalPrice,
      currency: updated.currency,
      priceNote: updated.priceNote,
      payments: serializePayments(updated),
      isFullyPaid: updated.isFullyPaid,
    },
  });
}
