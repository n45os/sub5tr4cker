import { Group, BillingPeriod } from "@/models";
import type { HydratedDocument } from "mongoose";
import {
  calculateShares,
  formatPeriodLabel,
  getPeriodDates,
} from "@/lib/billing/calculator";
import { getCollectionOpensAt } from "@/lib/billing/collection-window";
import { createConfirmationToken } from "@/lib/tokens";

// create the current billing period for a group if collection is open and it doesn't exist yet
export async function createPeriodIfDue(
  group: HydratedDocument<InstanceType<typeof Group>>,
  now: Date
): Promise<boolean> {
  const { cycleDay } = group.billing;
  const advance = group.billing.paymentInAdvanceDays ?? 0;

  const { start, end } = getPeriodDates(
    now.getFullYear(),
    now.getMonth(),
    cycleDay
  );

  const collectionOpensAt = getCollectionOpensAt(start, advance);
  if (now < collectionOpensAt) return false;

  const existing = await BillingPeriod.findOne({
    group: group._id,
    periodStart: start,
  });
  if (existing) return false;

  const shares = calculateShares(group, undefined, start);
  if (shares.length === 0) return false;

  const periodLabel = formatPeriodLabel(start);

  const payments = await Promise.all(
    shares.map(async (share) => {
      const token = await createConfirmationToken(
        share.memberId,
        "pending",
        group._id.toString()
      );
      return {
        memberId: share.memberId,
        memberEmail: share.email,
        memberNickname: share.nickname,
        amount: share.amount,
        status: "pending" as const,
        confirmationToken: token,
      };
    })
  );

  const period = await BillingPeriod.create({
    group: group._id,
    periodStart: start,
    collectionOpensAt,
    periodEnd: end,
    periodLabel,
    totalPrice: group.billing.currentPrice,
    currency: group.billing.currency,
    payments,
  });

  for (const payment of period.payments) {
    payment.confirmationToken = await createConfirmationToken(
      payment.memberId.toString(),
      period._id.toString(),
      group._id.toString()
    );
  }
  await period.save();

  return true;
}
