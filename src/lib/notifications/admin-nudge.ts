import { User } from "@/models";
import type { IGroup } from "@/models";
import type { IBillingPeriod } from "@/models/billing-period";
import { sendNotification } from "@/lib/notifications/service";
import {
  buildAdminFollowUpEmailHtml,
  buildAdminFollowUpTelegramText,
} from "@/lib/email/templates/admin-follow-up";

type GroupDoc = IGroup & { _id: { toString: () => string } };
type PeriodDoc = IBillingPeriod & {
  _id: { toString: () => string };
  periodLabel: string;
  currency: string;
  payments: Array<{ status: string; memberNickname: string; amount: number }>;
};

/**
 * Send admin a single notification to verify member_confirmed payments for a period.
 * No-op if there are no unverified payments or no admin user.
 */
export async function sendAdminConfirmationNudge(
  group: GroupDoc,
  period: PeriodDoc
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
