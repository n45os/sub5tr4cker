import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group } from "@/models";

/**
 * Mark pending payments as overdue when past 14 days since period start (renewal).
 * Unchanged by payment-in-advance: lateness is still relative to renewal, not collection open.
 * Does not send any notifications; use enqueue-reminders for that.
 */
export async function reconcileOverduePayments(): Promise<number> {
  await dbConnect();

  const now = new Date();
  let modifiedCount = 0;

  const periods = await BillingPeriod.find({
    isFullyPaid: false,
    periodStart: { $lt: now },
  });

  for (const period of periods) {
    const group = await Group.findById(period.group);
    if (!group || !group.isActive) continue;

    let modified = false;
    for (const payment of period.payments) {
      if (payment.status === "pending") {
        const daysSincePeriodStart = Math.floor(
          (now.getTime() - period.periodStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSincePeriodStart > 14) {
          payment.status = "overdue";
          modified = true;
        }
      }
    }
    if (modified) {
      await period.save();
      modifiedCount++;
    }
  }

  return modifiedCount;
}
