import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, isStorageId, type StorageMemberPayment } from "@/lib/storage";

const updatePeriodSchema = z
  .object({
    totalPrice: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
    priceNote: z.string().max(500).optional().nullable(),
    payments: z
      .array(
        z.object({
          memberId: z.string(),
          status: z.enum(["pending", "waived"]).optional(),
          adjustedAmount: z.number().nonnegative().optional().nullable(),
          adjustmentReason: z.string().max(500).optional().nullable(),
          notes: z.string().max(500).optional().nullable(),
        })
      )
      .optional(),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
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
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or period id" } },
      { status: 400 }
    );
  }

  const parsed = updatePeriodSchema.safeParse(await request.json());
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
      { error: { code: "FORBIDDEN", message: "Only the admin can update billing periods" } },
      { status: 403 }
    );
  }

  const period = await store.getBillingPeriod(periodId, groupId);
  if (!period) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Billing period not found" } },
      { status: 404 }
    );
  }

  const body = parsed.data;
  let totalPrice = period.totalPrice;
  let currency = period.currency;
  let priceNote = period.priceNote;
  let payments = [...period.payments];

  if (body.totalPrice !== undefined) totalPrice = body.totalPrice;
  if (body.currency !== undefined) currency = body.currency;
  if ("priceNote" in body) priceNote = body.priceNote ?? null;

  if (body.payments?.length) {
    for (const update of body.payments) {
      const idx = payments.findIndex((p: StorageMemberPayment) => p.memberId === update.memberId);
      if (idx === -1) continue;
      const payment = { ...payments[idx]! };
      if (update.status === "waived") payment.status = "waived";
      if ("adjustedAmount" in update) payment.adjustedAmount = update.adjustedAmount ?? null;
      if ("adjustmentReason" in update) payment.adjustmentReason = update.adjustmentReason ?? null;
      if ("notes" in update) payment.notes = update.notes ?? null;
      payments[idx] = payment;
    }
  }

  const isFullyPaid = payments.every(
    (p: StorageMemberPayment) => p.status === "confirmed" || p.status === "waived"
  );

  const updated = await store.updateBillingPeriod(periodId, {
    totalPrice,
    currency,
    priceNote,
    payments,
    isFullyPaid,
  });

  return NextResponse.json({
    data: {
      _id: updated.id,
      periodLabel: updated.periodLabel,
      totalPrice: updated.totalPrice,
      currency: updated.currency,
      priceNote: updated.priceNote,
      payments: updated.payments.map((p) => ({
        memberId: p.memberId,
        memberNickname: p.memberNickname,
        amount: p.amount,
        adjustedAmount: p.adjustedAmount,
        adjustmentReason: p.adjustmentReason,
        status: p.status,
        notes: p.notes,
        memberConfirmedAt: p.memberConfirmedAt ? p.memberConfirmedAt.toISOString() : null,
        adminConfirmedAt: p.adminConfirmedAt ? p.adminConfirmedAt.toISOString() : null,
      })),
      isFullyPaid: updated.isFullyPaid,
    },
  });
}

export async function DELETE(
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
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or period id" } },
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
      { error: { code: "FORBIDDEN", message: "Only the admin can delete billing periods" } },
      { status: 403 }
    );
  }

  const existing = await store.getBillingPeriod(periodId, groupId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Billing period not found" } },
      { status: 404 }
    );
  }

  await store.deleteBillingPeriod(periodId, groupId);

  return NextResponse.json({ data: { deleted: true } });
}
