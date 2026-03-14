import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group } from "@/models";
import { enqueueTask } from "@/lib/tasks/queue";

/**
 * Scan for unpaid billing periods past grace period and enqueue one
 * payment_reminder task per eligible payment. Idempotency key includes
 * period, payment, and run date so we only enqueue once per payment per day.
 */
export async function enqueueReminders(): Promise<number> {
  await dbConnect();

  const now = new Date();
  let enqueued = 0;

  const periods = await BillingPeriod.find({
    isFullyPaid: false,
    periodStart: { $lt: now },
    "payments.status": { $in: ["pending", "overdue"] },
  }).populate("group");

  for (const period of periods) {
    const group = await Group.findById(period.group);
    if (!group || !group.isActive) continue;
    if (group.notifications?.remindersEnabled === false) continue;

    const graceDays = group.billing.gracePeriodDays ?? 3;
    const graceDate = new Date(period.periodStart);
    graceDate.setDate(graceDate.getDate() + graceDays);
    if (now < graceDate) continue;

    const groupId = (group._id as { toString: () => string }).toString();
    const billingPeriodId = (period._id as { toString: () => string }).toString();

    for (const payment of period.payments) {
      if (payment.status !== "pending" && payment.status !== "overdue") {
        continue;
      }

      const paymentId = (payment._id as { toString: () => string }).toString();
      const task = await enqueueTask({
        type: "payment_reminder",
        runAt: now,
        payload: {
          groupId,
          billingPeriodId,
          memberId: (payment.memberId as { toString: () => string }).toString(),
          paymentId,
        },
      });
      if (task) enqueued++;
    }
  }

  return enqueued;
}
