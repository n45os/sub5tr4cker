/**
 * collection window: when a period becomes visible for unpaid tracking and when
 * automated reminders may start (after grace from collection open)
 */

/** mongo filter: period is open for outstanding/reminders (collection open has passed) */
export function collectionWindowOpenFilter(now: Date) {
  return {
    $expr: {
      $lte: [{ $ifNull: ["$collectionOpensAt", "$periodStart"] }, now],
    },
    // archived periods (soft-deleted groups, see scripts/db-cleanup.ts
    // --orphan-periods) must not surface in active workflows. matches both
    // missing and explicit-null.
    archivedAt: null,
  };
}

/** first instant members may owe / see the period (before renewal when advance > 0) */
export function getCollectionOpensAt(
  periodStart: Date,
  paymentInAdvanceDays: number
): Date {
  const d = new Date(periodStart);
  d.setUTCDate(d.getUTCDate() - paymentInAdvanceDays);
  return d;
}

/** first day cron may enqueue payment reminders (grace after collection opens) */
export function getFirstReminderEligibleAt(
  collectionOpensAt: Date,
  gracePeriodDays: number
): Date {
  const d = new Date(collectionOpensAt);
  d.setUTCDate(d.getUTCDate() + gracePeriodDays);
  return d;
}

/** use stored value, or period start for legacy rows without collectionOpensAt */
export function resolveCollectionOpensAt(period: {
  collectionOpensAt?: Date | null;
  periodStart: Date;
}): Date {
  return period.collectionOpensAt ?? period.periodStart;
}
