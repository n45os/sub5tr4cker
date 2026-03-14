import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IGroupMember, IMemberPayment } from "@/models";

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

  const userId = session.user.id;
  const userEmail = (session.user.email as string) || "";

  const member = group.members.find(
    (m: IGroupMember) =>
      m.isActive &&
      !m.leftAt &&
      (m.user?.toString() === userId || m.email === userEmail)
  );
  if (!member) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not a member of this group" } },
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
    (p: IMemberPayment) => p.memberId.toString() === member._id.toString()
  );
  if (!payment) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No payment entry for you in this period" } },
      { status: 404 }
    );
  }

  if (payment.status !== "pending" && payment.status !== "overdue") {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "Payment already confirmed or waived",
        },
      },
      { status: 409 }
    );
  }

  payment.status = "member_confirmed";
  payment.memberConfirmedAt = new Date();
  await period.save();

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "payment_self_confirmed",
    groupId,
    billingPeriodId: periodId,
    targetMemberId: member._id.toString(),
  });

  return NextResponse.json({
    data: {
      memberId: payment.memberId.toString(),
      status: payment.status,
      memberConfirmedAt: payment.memberConfirmedAt?.toISOString() ?? null,
    },
  });
}
