/**
 * Order billing periods for display: current period first, then past (newest first),
 * then at most maxFuture future periods. If there are future dates, we show max 2
 * by default; more can be viewed on the analytical page.
 */

export const DEFAULT_MAX_FUTURE_PERIODS = 2;

export interface PeriodWithDates {
  _id: string;
  periodStart?: string;
  periodEnd?: string;
  [key: string]: unknown;
}

export function orderPeriodsForDisplay<T extends PeriodWithDates>(
  periods: T[],
  options: { maxFuture?: number } = {}
): T[] {
  const maxFuture = options.maxFuture ?? DEFAULT_MAX_FUTURE_PERIODS;
  const today = new Date();

  const current = periods.find((p) => {
    if (!p.periodStart || !p.periodEnd) return false;
    const start = new Date(p.periodStart);
    const end = new Date(p.periodEnd);
    return today >= start && today <= end;
  });

  const past = periods
    .filter((p) => p.periodEnd && today > new Date(p.periodEnd))
    .sort(
      (a, b) =>
        new Date(b.periodEnd!).getTime() - new Date(a.periodEnd!).getTime()
    );

  // future = periodStart strictly after today; show at most maxFuture (e.g. 2)
  const future = periods
    .filter((p) => p.periodStart && today < new Date(p.periodStart))
    .sort(
      (a, b) =>
        new Date(a.periodStart!).getTime() - new Date(b.periodStart!).getTime()
    );

  const currentList = current ? [current] : [];
  const futureCapped = future.slice(0, maxFuture);
  return [...currentList, ...past, ...futureCapped] as T[];
}

/** Classify a period for row highlighting (current month vs past). */
export function getPeriodDisplayState(period: {
  _id: string;
  periodStart?: string;
  periodEnd?: string;
}): {
  isCurrent: boolean;
  isPast: boolean;
} {
  if (!period.periodStart || !period.periodEnd) {
    return { isCurrent: false, isPast: false };
  }
  const today = new Date();
  const start = new Date(period.periodStart);
  const end = new Date(period.periodEnd);
  const isCurrent = today >= start && today <= end;
  const isPast = today > end;
  return { isCurrent, isPast };
}
