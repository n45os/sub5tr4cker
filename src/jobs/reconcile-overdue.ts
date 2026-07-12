import { db } from "@/lib/storage";

/**
 * Mark pending payments as overdue when past 14 days since period start (renewal).
 * Unchanged by payment-in-advance: lateness is still relative to renewal, not collection open.
 * Does not send any notifications; use enqueue-reminders for that.
 */
export async function reconcileOverduePayments(): Promise<number> {
  const store = await db();
  const now = new Date();
  let modifiedCount = 0;

  const periods = await store.listUnpaidPeriodsWithStartBefore(now);

  for (const period of periods) {
    const group = await store.getGroup(period.groupId);
    if (!group || !group.isActive) continue;

    const daysSincePeriodStart = Math.floor(
      (now.getTime() - period.periodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSincePeriodStart <= 14) continue;

    // targeted per-payment updates so concurrent confirms aren't overwritten
    let modified = false;
    for (const payment of period.payments) {
      if (payment.status !== "pending") continue;
      await store.updatePaymentStatus(period.id, payment.memberId, {
        status: "overdue",
      });
      modified = true;
    }
    if (modified) modifiedCount++;
  }

  return modifiedCount;
}
