import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group, User } from "@/models";
import { sendNotification } from "@/lib/notifications/service";
import { paymentConfirmationKeyboard } from "@/lib/telegram/keyboards";
import { getConfirmationUrl } from "@/lib/tokens";

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
    ? getConfirmationUrl(payment.confirmationToken)
    : null;

  const paymentLink = group.payment.link;
  const currency = period.currency || "€";

  // build email HTML
  const emailHtml = buildReminderEmailHtml({
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
      telegramText:
        `💳 *Payment Reminder*\n\n` +
        `${payment.memberNickname}, you owe *${payment.amount.toFixed(2)}${currency}*\n` +
        `for *${group.name}* — ${period.periodLabel}\n\n` +
        (paymentLink ? `Pay: ${paymentLink}\n\n` : "") +
        `Tap below to confirm once paid.`,
      telegramKeyboard: keyboard,
      groupId: group._id.toString(),
      billingPeriodId: period._id.toString(),
    }
  );
}

function buildReminderEmailHtml(params: {
  memberName: string;
  groupName: string;
  periodLabel: string;
  amount: number;
  currency: string;
  paymentPlatform: string;
  paymentLink: string | null;
  confirmUrl: string | null;
  ownerName: string;
  extraText: string | null;
}): string {
  // basic email template — will be replaced with React Email in phase 2
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { background: #3b82f6; color: #fff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .body { padding: 24px; }
        .amount { font-size: 28px; font-weight: bold; color: #1e293b; text-align: center; margin: 20px 0; }
        .btn { display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; }
        .btn-confirm { background: #22c55e; }
        .footer { padding: 16px 24px; background: #f8fafc; color: #94a3b8; font-size: 12px; text-align: center; }
        .cta { text-align: center; margin: 24px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Reminder</h1>
        </div>
        <div class="body">
          <p>Hi ${params.memberName},</p>
          <p>You owe for <strong>${params.groupName}</strong> — ${params.periodLabel}:</p>
          <div class="amount">${params.amount.toFixed(2)}${params.currency}</div>
          ${params.paymentLink ? `
            <div class="cta">
              <a href="${params.paymentLink}" class="btn">Pay via ${params.paymentPlatform}</a>
            </div>
          ` : ""}
          ${params.confirmUrl ? `
            <div class="cta">
              <a href="${params.confirmUrl}" class="btn btn-confirm">I've Paid</a>
            </div>
          ` : ""}
          ${params.extraText ? `<p style="color: #64748b; font-size: 13px;">${params.extraText}</p>` : ""}
          <p>Thank you!</p>
        </div>
        <div class="footer">
          <p>Sent by SubsTrack</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
