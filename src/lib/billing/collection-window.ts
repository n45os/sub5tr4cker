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
  };
}

/** first instant members may owe / see the period (before renewal when advance > 0) */
export function getCollectionOpensAt(
  periodStart: Date,
  paymentInAdvanceDays: number
): Date {
  const d = new Date(periodStart);
  d.setDate(d.getDate() - paymentInAdvanceDays);
  return d;
}

/** first day cron may enqueue payment reminders (grace after collection opens) */
export function getFirstReminderEligibleAt(
  collectionOpensAt: Date,
  gracePeriodDays: number
): Date {
  const d = new Date(collectionOpensAt);
  d.setDate(d.getDate() + gracePeriodDays);
  return d;
}

/** use stored value, or period start for legacy rows without collectionOpensAt */
export function resolveCollectionOpensAt(period: {
  collectionOpensAt?: Date | null;
  periodStart: Date;
}): Date {
  return period.collectionOpensAt ?? period.periodStart;
}
