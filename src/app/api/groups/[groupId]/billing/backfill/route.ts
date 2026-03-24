import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import {
  calculateShares,
  formatPeriodLabel,
  getPeriodDates,
} from "@/lib/billing/calculator";
import { createConfirmationToken } from "@/lib/tokens";
import { getCollectionOpensAt } from "@/lib/billing/collection-window";

const backfillSchema = z.object({
  monthsBack: z.number().int().min(1).max(12),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 },
    );
  }

  const { groupId } = await context.params;
  if (!mongoose.isValidObjectId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 },
    );
  }

  const parsed = backfillSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
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
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the admin can create previous periods",
        },
      },
      { status: 403 },
    );
  }

  const { monthsBack } = parsed.data;
  const cycleDay = group.billing.cycleDay;
  const createdPeriods: Array<{
    _id: string;
    periodLabel: string;
    periodStart: string;
    totalPrice: number;
    paymentsCount: number;
  }> = [];

  // anchor: earliest existing period start, or current period start if none
  const earliest = await BillingPeriod.findOne({ group: groupId })
    .sort({ periodStart: 1 })
    .select("periodStart")
    .lean()
    .exec();

  let anchorYear: number;
  let anchorMonth: number;

  if (earliest?.periodStart) {
    const d = new Date(earliest.periodStart);
    anchorYear = d.getFullYear();
    anchorMonth = d.getMonth();
  } else {
    const now = new Date();
    anchorYear = now.getFullYear();
    anchorMonth = now.getMonth();
    if (now.getDate() < cycleDay) {
      anchorMonth -= 1;
      if (anchorMonth < 0) {
        anchorMonth += 12;
        anchorYear -= 1;
      }
    }
  }

  for (let i = 1; i <= monthsBack; i++) {
    const currentMonth = anchorMonth - i;
    const adjustedYear = anchorYear + Math.floor(currentMonth / 12);
    const adjustedMonth = ((currentMonth % 12) + 12) % 12;

    const { start, end } = getPeriodDates(adjustedYear, adjustedMonth, cycleDay);
    const label = formatPeriodLabel(start);

    const existing = await BillingPeriod.findOne({
      group: groupId,
      periodStart: start,
    });
    if (existing) continue;

    // use current active members for past periods so we always create the period;
    // admin can then record or import history (members who joined later can be waived)
    const shares = calculateShares(group, undefined, undefined);
    if (shares.length === 0) continue;

    const payments = await Promise.all(
      shares.map(async (share) => ({
        memberId: share.memberId,
        memberEmail: share.email,
        memberNickname: share.nickname,
        amount: share.amount,
        status: "pending" as const,
        confirmationToken: await createConfirmationToken(
          share.memberId,
          "",
          groupId,
        ),
      })),
    );

    const collectionOpensAt = getCollectionOpensAt(
      start,
      group.billing.paymentInAdvanceDays ?? 0
    );

    const period = await BillingPeriod.create({
      group: groupId,
      periodStart: start,
      collectionOpensAt,
      periodEnd: end,
      periodLabel: label,
      totalPrice: group.billing.currentPrice,
      currency: group.billing.currency,
      payments,
    });

    for (const payment of period.payments) {
      payment.confirmationToken = await createConfirmationToken(
        payment.memberId.toString(),
        period._id.toString(),
        groupId,
      );
    }
    await period.save();

    createdPeriods.push({
      _id: period._id.toString(),
      periodLabel: period.periodLabel,
      periodStart: period.periodStart.toISOString().slice(0, 10),
      totalPrice: period.totalPrice,
      paymentsCount: period.payments.length,
    });
  }

  return NextResponse.json({
    data: {
      created: createdPeriods.length,
      periods: createdPeriods,
    },
  });
}
