import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group } from "@/models";
import { sendReminderForPayment } from "@/lib/notifications/reminder-send";

// send payment reminders for unpaid billing periods
export async function sendReminders(): Promise<void> {
  await dbConnect();

  const now = new Date();

  // find billing periods with pending payments
  const periods = await BillingPeriod.find({
    isFullyPaid: false,
    periodStart: { $lt: now },
    "payments.status": { $in: ["pending", "overdue"] },
  }).populate("group");

  for (const period of periods) {
    const group = await Group.findById(period.group);
    if (!group || !group.isActive) continue;
    if (group.notifications?.remindersEnabled === false) continue;

    // check grace period
    const graceDays = group.billing.gracePeriodDays || 3;
    const graceDate = new Date(period.periodStart);
    graceDate.setDate(graceDate.getDate() + graceDays);
    if (now < graceDate) continue;

    for (const payment of period.payments) {
      if (payment.status !== "pending" && payment.status !== "overdue") {
        continue;
      }

      try {
        await sendReminderForPayment(group, period, payment);
      } catch (error) {
        console.error(
          `error sending reminder to ${payment.memberEmail}:`,
          error
        );
      }
    }

    // log that reminders were sent
    period.reminders.push({
      sentAt: new Date(),
      channel: "email",
      recipientCount: period.payments.filter(
        (p: { status: string }) => p.status === "pending" || p.status === "overdue"
      ).length,
      type: period.reminders.length === 0 ? "initial" : "follow_up",
    });
    await period.save();
  }
}
