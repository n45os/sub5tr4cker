import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group, User } from "@/models";
import { sendNotification } from "@/lib/notifications/service";
import {
  buildAdminFollowUpEmailHtml,
  buildAdminFollowUpTelegramText,
} from "@/lib/email/templates/admin-follow-up";

// send follow-up reminders:
// - nudge members who still haven't paid
// - remind admin about member_confirmed payments awaiting verification
export async function sendFollowUps(): Promise<void> {
  await dbConnect();

  const now = new Date();

  const periods = await BillingPeriod.find({
    isFullyPaid: false,
    periodStart: { $lt: now },
  });

  for (const period of periods) {
    const group = await Group.findById(period.group);
    if (!group || !group.isActive) continue;
    if (group.notifications?.followUpsEnabled === false) continue;

    // remind admin about unverified member confirmations
    await nudgeAdminForConfirmations(group, period);

    // mark old pending payments as overdue
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
    if (modified) await period.save();
  }
}

async function nudgeAdminForConfirmations(
  group: InstanceType<typeof Group>,
  period: InstanceType<typeof BillingPeriod>
): Promise<void> {
  const unverified = period.payments.filter(
    (p: { status: string }) => p.status === "member_confirmed"
  );
  if (unverified.length === 0) return;

  const admin = await User.findById(group.admin);
  if (!admin) return;

  const templateParams = {
    groupName: group.name,
    periodLabel: period.periodLabel,
    currency: period.currency,
    unverifiedMembers: unverified.map(
      (payment: { memberNickname: string; amount: number }) => ({
        memberNickname: payment.memberNickname,
        amount: payment.amount,
      })
    ),
    accentColor: group.service?.accentColor ?? null,
  };

  const emailHtml = buildAdminFollowUpEmailHtml(templateParams);
  const telegramText = buildAdminFollowUpTelegramText(templateParams);

  await sendNotification(
    {
      email: admin.email,
      telegramChatId: admin.telegram?.chatId,
      userId: admin._id.toString(),
      preferences: {
        email: admin.notificationPreferences?.email ?? true,
        telegram: admin.notificationPreferences?.telegram ?? false,
      },
    },
    {
      type: "admin_confirmation_request",
      subject: `Verify payments for ${group.name} — ${period.periodLabel}`,
      emailHtml,
      telegramText,
      groupId: group._id.toString(),
      billingPeriodId: period._id.toString(),
    }
  );
}
