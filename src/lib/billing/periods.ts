import { nanoid } from "nanoid";
import {
  calculateShares,
  formatPeriodLabel,
  getPeriodDates,
} from "@/lib/billing/calculator";
import { getCollectionOpensAt } from "@/lib/billing/collection-window";
import { db, type StorageGroup } from "@/lib/storage";
import { createConfirmationToken } from "@/lib/tokens";

// create the current billing period for a group if collection is open and it doesn't exist yet
export async function createPeriodIfDue(
  group: StorageGroup,
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

  const store = await db();
  const existing = await store.getBillingPeriodByStart(group.id, start);
  if (existing) return false;

  const shares = calculateShares(group, undefined, start);
  if (shares.length === 0) return false;

  const periodLabel = formatPeriodLabel(start);

  const payments = await Promise.all(
    shares.map(async (share) => {
      const token = await createConfirmationToken(
        share.memberId,
        "pending",
        group.id
      );
      return {
        id: nanoid(),
        memberId: share.memberId,
        memberEmail: share.email,
        memberNickname: share.nickname,
        adjustedAmount: null,
        adjustmentReason: null,
        amount: share.amount,
        memberConfirmedAt: null,
        adminConfirmedAt: null,
        status: "pending" as const,
        confirmationToken: token,
        notes: null,
      };
    })
  );

  const period = await store.createBillingPeriod({
    groupId: group.id,
    periodStart: start,
    collectionOpensAt,
    periodEnd: end,
    periodLabel,
    totalPrice: group.billing.currentPrice,
    currency: group.billing.currency,
    priceNote: null,
    payments,
    reminders: [],
    isFullyPaid: false,
  });

  const updatedPayments = await Promise.all(
    period.payments.map(async (payment) => ({
      ...payment,
      confirmationToken: await createConfirmationToken(
        payment.memberId,
        period.id,
        group.id
      ),
    }))
  );
  await store.updateBillingPeriod(period.id, { payments: updatedPayments });

  return true;
}
