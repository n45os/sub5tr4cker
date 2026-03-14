import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group, User } from "@/models";
import { sendNotification } from "@/lib/notifications/service";
import { paymentConfirmationKeyboard } from "@/lib/telegram/keyboards";
import { getConfirmationUrl } from "@/lib/tokens";
import {
  buildPaymentReminderEmailHtml,
  buildPaymentReminderTelegramText,
} from "@/lib/email/templates/payment-reminder";

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
        await sendReminderToMember(group, period, payment);
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

async function sendReminderToMember(
  group: InstanceType<typeof Group>,
  period: InstanceType<typeof BillingPeriod>,
  payment: {
    memberId: { toString: () => string };
    memberEmail: string;
    memberNickname: string;
    amount: number;
    confirmationToken: string | null;
  }
): Promise<void> {
  // look up member's user account for Telegram
  const member = group.members.find(
    (m: { _id: { toString: () => string } }) => m._id.toString() === payment.memberId.toString()
  );
  const user = member?.user ? await User.findById(member.user) : null;

  const confirmUrl = payment.confirmationToken
    ? await getConfirmationUrl(payment.confirmationToken)
    : null;

  const paymentLink = group.payment.link;
  const currency = period.currency || "€";

  // build email HTML
  const emailHtml = buildPaymentReminderEmailHtml({
    memberName: payment.memberNickname,
    groupName: group.name,
    periodLabel: period.periodLabel,
    amount: payment.amount,
    currency,
    paymentPlatform: group.payment.platform,
    paymentLink,
    confirmUrl,
    ownerName: "the admin",
    extraText: group.announcements.extraText,
  });

  // build telegram text + keyboard
  const keyboard = paymentConfirmationKeyboard(
    period._id.toString(),
    payment.memberId.toString()
  );

  await sendNotification(
    {
      email: payment.memberEmail,
      telegramChatId: user?.telegram?.chatId,
      userId: user?._id?.toString(),
      preferences: {
        email: user?.notificationPreferences?.email ?? true,
        telegram: user?.notificationPreferences?.telegram ?? false,
      },
    },
    {
      type: "payment_reminder",
      subject: `Pay your ${group.service.name} share — ${period.periodLabel}`,
      emailHtml,
      telegramText: buildPaymentReminderTelegramText({
        memberName: payment.memberNickname,
        groupName: group.name,
        periodLabel: period.periodLabel,
        amount: payment.amount,
        currency,
        paymentLink,
      }),
      telegramKeyboard: keyboard,
      groupId: group._id.toString(),
      billingPeriodId: period._id.toString(),
    }
  );
}
