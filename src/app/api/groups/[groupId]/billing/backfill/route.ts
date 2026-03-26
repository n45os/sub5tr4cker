import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import {
  calculateShares,
  formatPeriodLabel,
  getPeriodDates,
} from "@/lib/billing/calculator";
import { getCollectionOpensAt } from "@/lib/billing/collection-window";
import { createConfirmationToken } from "@/lib/tokens";
import { db, isStorageId } from "@/lib/storage";

const backfillSchema = z.object({
  monthsBack: z.number().int().min(1).max(12),
});

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
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the admin can create previous periods",
        },
      },
      { status: 403 }
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

  const existingPeriods = await store.getPeriodsForGroup(groupId);
  const earliestRow =
    existingPeriods.length > 0
      ? [...existingPeriods].sort(
          (a, b) => a.periodStart.getTime() - b.periodStart.getTime()
        )[0]
      : null;

  let anchorYear: number;
  let anchorMonth: number;

  if (earliestRow) {
    const d = new Date(earliestRow.periodStart);
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

    const existing = await store.getBillingPeriodByStart(groupId, start);
    if (existing) continue;

    const shares = calculateShares(group, undefined, undefined);
    if (shares.length === 0) continue;

    const paymentRows = await Promise.all(
      shares.map(async (share) => ({
        id: nanoid(),
        memberId: share.memberId,
        memberEmail: share.email,
        memberNickname: share.nickname,
        amount: share.amount,
        adjustedAmount: null as number | null,
        adjustmentReason: null as string | null,
        status: "pending" as const,
        memberConfirmedAt: null as Date | null,
        adminConfirmedAt: null as Date | null,
        confirmationToken: await createConfirmationToken(share.memberId, "", groupId),
        notes: null as string | null,
      }))
    );

    const collectionOpensAt = getCollectionOpensAt(
      start,
      group.billing.paymentInAdvanceDays ?? 0
    );

    const created = await store.createBillingPeriod({
      groupId,
      periodStart: start,
      collectionOpensAt,
      periodEnd: end,
      periodLabel: label,
      totalPrice: group.billing.currentPrice,
      currency: group.billing.currency,
      priceNote: null,
      payments: paymentRows,
      reminders: [],
      isFullyPaid: false,
    });

    const paymentsWithTokens = await Promise.all(
      created.payments.map(async (payment) => ({
        ...payment,
        confirmationToken: await createConfirmationToken(
          payment.memberId,
          created.id,
          groupId
        ),
      }))
    );

    await store.updateBillingPeriod(created.id, { payments: paymentsWithTokens });

    const period = (await store.getBillingPeriod(created.id, groupId))!;

    createdPeriods.push({
      _id: period.id,
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
