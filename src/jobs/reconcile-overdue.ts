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

    let modified = false;
    const payments = period.payments.map((payment) => {
      if (payment.status !== "pending") return payment;
      const daysSincePeriodStart = Math.floor(
        (now.getTime() - period.periodStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSincePeriodStart > 14) {
        modified = true;
        return { ...payment, status: "overdue" as const };
      }
      return payment;
    });

    if (modified) {
      await store.updateBillingPeriod(period.id, { payments });
      modifiedCount++;
    }
  }

  return modifiedCount;
}
