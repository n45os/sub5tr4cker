import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IMemberPayment } from "@/models";
import {
  calculateShares,
  formatPeriodLabel,
  getPeriodDates,
} from "@/lib/billing/calculator";
import { createConfirmationToken } from "@/lib/tokens";

const advanceSchema = z.object({
  monthsAhead: z.number().int().min(1).max(12),
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

  const parsed = advanceSchema.safeParse(await request.json());
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
      { error: { code: "FORBIDDEN", message: "Only the admin can generate advance periods" } },
      { status: 403 },
    );
  }

  const { monthsAhead } = parsed.data;
  const now = new Date();
  const cycleDay = group.billing.cycleDay;
  const createdPeriods: Array<{
    _id: string;
    periodLabel: string;
    periodStart: string;
    totalPrice: number;
    paymentsCount: number;
  }> = [];

  const existingCount = await BillingPeriod.countDocuments({ group: groupId });
  let year = now.getFullYear();
  let month = now.getMonth();

  if (existingCount === 0) {
    // when no periods exist, create the current period first (the one that includes today)
    if (now.getDate() < cycleDay) {
      month -= 1;
      if (month < 0) {
        month += 12;
        year -= 1;
      }
    }
  } else {
    // when periods exist, start from next upcoming period
    if (now.getDate() >= cycleDay) {
      month += 1;
    }
  }

  // when no periods exist, try more months (up to 12) until we create at least one
  // — members who joined mid-cycle are excluded from the current period, so we may need the next
  const maxIterations = existingCount === 0 ? Math.max(monthsAhead, 12) : monthsAhead;

  for (let i = 0; i < maxIterations && createdPeriods.length < monthsAhead; i++) {
    const currentMonth = month + i;
    const adjustedYear = year + Math.floor(currentMonth / 12);
    const adjustedMonth = currentMonth % 12;

    const { start, end } = getPeriodDates(adjustedYear, adjustedMonth, cycleDay);
    const label = formatPeriodLabel(start);

    // skip if period already exists
    const existing = await BillingPeriod.findOne({
      group: groupId,
      periodStart: start,
    });
    if (existing) continue;

    const shares = calculateShares(group, undefined, start);
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

    const period = await BillingPeriod.create({
      group: groupId,
      periodStart: start,
      periodEnd: end,
      periodLabel: label,
      totalPrice: group.billing.currentPrice,
      currency: group.billing.currency,
      payments,
    });

    // regenerate tokens with real period id
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
