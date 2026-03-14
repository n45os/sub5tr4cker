import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IMemberPayment } from "@/models";

const confirmSchema = z.object({
  memberId: z.string(),
  action: z.enum(["confirm", "reject"]),
  notes: z.string().max(500).optional(),
});

export async function POST(
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

  const parsed = confirmSchema.safeParse(await request.json());
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
      { error: { code: "FORBIDDEN", message: "Only the admin can confirm payments" } },
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

  const payment = period.payments.find(
    (p: IMemberPayment) => p.memberId.toString() === parsed.data.memberId
  );
  if (!payment) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Payment entry not found" } },
      { status: 404 }
    );
  }

  if (parsed.data.action === "confirm") {
    payment.status = "confirmed";
    payment.adminConfirmedAt = new Date();
  } else {
    payment.status = "pending";
    payment.adminConfirmedAt = null;
  }
  if (parsed.data.notes !== undefined) payment.notes = parsed.data.notes;

  period.isFullyPaid = period.payments.every(
    (p: IMemberPayment) => p.status === "confirmed" || p.status === "waived"
  );
  await period.save();

  return NextResponse.json({
    data: {
      memberId: payment.memberId.toString(),
      status: payment.status,
      adminConfirmedAt: payment.adminConfirmedAt?.toISOString() ?? null,
    },
  });
}
