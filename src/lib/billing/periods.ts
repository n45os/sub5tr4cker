import { nanoid } from "nanoid";
import { logAudit } from "@/lib/audit";
import {
  calculateShares,
  formatPeriodLabel,
  getPeriodDates,
} from "@/lib/billing/calculator";
import { getCollectionOpensAt } from "@/lib/billing/collection-window";
import {
  db,
  type StorageAdapter,
  type StorageBillingPeriod,
  type StorageGroup,
} from "@/lib/storage";
import { createConfirmationToken } from "@/lib/tokens";

// belt-and-braces dedup: locate any existing billing period for this group
// whose periodStart falls in the same UTC calendar month, regardless of the
// exact instant. callers should treat a hit as "already created — reuse it".
export async function findExistingPeriodForMonth(
  store: StorageAdapter,
  groupId: string,
  year: number,
  monthIndex: number
): Promise<StorageBillingPeriod | null> {
  const periods = await store.getPeriodsForGroup(groupId);
  return (
    periods.find(
      (p) =>
        p.periodStart.getUTCFullYear() === year &&
        p.periodStart.getUTCMonth() === monthIndex
    ) ?? null
  );
}

// create the current billing period for a group if collection is open and it doesn't exist yet
export async function createPeriodIfDue(
  group: StorageGroup,
  now: Date
): Promise<boolean> {
  const { cycleDay } = group.billing;
  const advance = group.billing.paymentInAdvanceDays ?? 0;

  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  const { start, end } = getPeriodDates(year, monthIndex, cycleDay);

  const collectionOpensAt = getCollectionOpensAt(start, advance);
  if (now < collectionOpensAt) return false;

  const store = await db();
  const existing = await findExistingPeriodForMonth(
    store,
    group.id,
    year,
    monthIndex
  );
  if (existing) {
    // a row for this calendar month is already present — emit a dedup audit
    // so we can spot any callers still racing past the storage-level guard.
    if (existing.periodStart.getTime() !== start.getTime()) {
      await logAudit({
        actorId: group.adminId,
        actorName: "System (cron)",
        action: "period_dedup_hit",
        groupId: group.id,
        billingPeriodId: existing.id,
        metadata: {
          source: "createPeriodIfDue",
          candidatePeriodStart: start.toISOString(),
          existingPeriodStart: existing.periodStart.toISOString(),
          year,
          monthIndex,
        },
      });
    }
    return false;
  }

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
