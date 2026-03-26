import { db, type StorageBillingPeriod, type StorageGroup } from "@/lib/storage";
import { sendNotification } from "@/lib/notifications/service";
import {
  buildAdminFollowUpEmailHtml,
  buildAdminFollowUpTelegramText,
} from "@/lib/email/templates/admin-follow-up";
import { isTelegramEnabled } from "@/lib/telegram/bot";
import { getSetting } from "@/lib/settings/service";

type GroupDoc = StorageGroup;
type PeriodDoc = Pick<
  StorageBillingPeriod,
  "id" | "periodLabel" | "currency" | "payments"
>;

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

  const store = await db();
  const admin = await store.getUser(group.adminId);
  if (!admin) return;
  const appUrl = ((await getSetting("general.appUrl")) || "").replace(/\/$/, "");
  const dashboardUrl = appUrl
    ? `${appUrl}/dashboard/groups/${group.id}/billing`
    : null;

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
    dashboardUrl,
    accentColor: group.service?.accentColor ?? null,
    theme: group.service?.emailTheme ?? "clean",
  };

  const emailHtml = buildAdminFollowUpEmailHtml(templateParams);
  const telegramText = buildAdminFollowUpTelegramText(templateParams);

  const emailParams =
    group.notifications?.saveEmailParams === true
      ? { template: "admin_follow_up" as const, ...templateParams }
      : undefined;

  // when telegram is linked + enabled in profile, nudge on tg only; otherwise email (if allowed)
  const telegramPref = admin.notificationPreferences?.telegram ?? false;
  const emailPref = admin.notificationPreferences?.email ?? true;
  const botOn = await isTelegramEnabled();
  const canDeliverTelegram =
    telegramPref && !!admin.telegram?.chatId && botOn;

  await sendNotification(
    {
      email: admin.email,
      telegramChatId: admin.telegram?.chatId,
      userId: admin.id,
      preferences: {
        telegram: telegramPref,
        email: !canDeliverTelegram && emailPref,
      },
    },
    {
      type: "admin_confirmation_request",
      subject: `Verify payments for ${group.name} — ${period.periodLabel}`,
      emailHtml,
      telegramText,
      groupId: group.id,
      billingPeriodId: period.id,
      emailParams,
    }
  );
}
