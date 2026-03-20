import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IMemberPayment } from "@/models";

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
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(periodId)) {
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
      { error: { code: "FORBIDDEN", message: "Only the admin can update billing periods" } },
      { status: 403 }
    );
  }

  const period = await BillingPeriod.findOne({
    _id: periodId,
    group: groupId,
  });
  if (!period) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Billing period not found" } },
      { status: 404 }
    );
  }

  const body = parsed.data;
  if (body.totalPrice !== undefined) period.totalPrice = body.totalPrice;
  if (body.currency !== undefined) period.currency = body.currency;
  if ("priceNote" in body) period.priceNote = body.priceNote ?? null;

  if (body.payments?.length) {
    for (const update of body.payments) {
      const payment = period.payments.find(
        (p: IMemberPayment) => p.memberId.toString() === update.memberId
      );
      if (payment) {
        if (update.status === "waived") payment.status = "waived";
        if ("adjustedAmount" in update) payment.adjustedAmount = update.adjustedAmount ?? null;
        if ("adjustmentReason" in update) payment.adjustmentReason = update.adjustmentReason ?? null;
        if ("notes" in update) payment.notes = update.notes ?? null;
      }
    }
  }

  period.isFullyPaid = period.payments.every(
    (p: IMemberPayment) => p.status === "confirmed" || p.status === "waived"
  );
  await period.save();

  return NextResponse.json({
    data: {
      _id: period._id.toString(),
      periodLabel: period.periodLabel,
      totalPrice: period.totalPrice,
      currency: period.currency,
      priceNote: period.priceNote,
      payments: period.payments.map((p: IMemberPayment) => ({
        memberId: p.memberId.toString(),
        memberNickname: p.memberNickname,
        amount: p.amount,
        adjustedAmount: p.adjustedAmount,
        adjustmentReason: p.adjustmentReason,
        status: p.status,
        notes: p.notes,
        memberConfirmedAt: p.memberConfirmedAt
          ? (p.memberConfirmedAt as Date).toISOString()
          : null,
        adminConfirmedAt: p.adminConfirmedAt
          ? (p.adminConfirmedAt as Date).toISOString()
          : null,
      })),
      isFullyPaid: period.isFullyPaid,
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
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(periodId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or period id" } },
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
      { error: { code: "FORBIDDEN", message: "Only the admin can delete billing periods" } },
      { status: 403 }
    );
  }

  const period = await BillingPeriod.findOneAndDelete({
    _id: periodId,
    group: groupId,
  });
  if (!period) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Billing period not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { deleted: true } });
}
