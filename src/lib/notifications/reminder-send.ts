import { db, type StorageBillingPeriod, type StorageGroup, type StorageMemberPayment } from "@/lib/storage";
import { sendNotification } from "@/lib/notifications/service";
import { getReminderEligibility, type PaymentLike } from "@/lib/notifications/reminder-targeting";
import { paymentConfirmationKeyboard } from "@/lib/telegram/keyboards";
import {
  createMemberPortalToken,
  getMemberPortalUrl,
  createUnsubscribeToken,
  getUnsubscribeUrl,
} from "@/lib/tokens";
import {
  buildPaymentReminderEmailHtml,
  buildPaymentReminderTelegramText,
} from "@/lib/email/templates/payment-reminder";
import { getRecipientLabel } from "@/lib/notifications/member-email";

export interface SendReminderResult {
  emailSent: boolean;
  telegramSent: boolean;
}

type GroupDoc = StorageGroup;
type PeriodDoc = StorageBillingPeriod;

export type ChannelOverride = "email" | "telegram" | "both";

function asId(value: { toString: () => string } | string): string {
  return value.toString();
}

/** send a single payment reminder (respects eligibility; no-op if no channel reachable) */
export async function sendReminderForPayment(
  group: GroupDoc,
  period: PeriodDoc,
  payment: PaymentLike,
  options?: { channelOverride?: ChannelOverride }
): Promise<SendReminderResult> {
  const eligibility = await getReminderEligibility({ group, period, payment });
  let sendEmail = eligibility.sendEmail;
  let sendTelegram = eligibility.sendTelegram;
  if (options?.channelOverride === "email") sendTelegram = false;
  if (options?.channelOverride === "telegram") sendEmail = false;
  if (!sendEmail && !sendTelegram) {
    return { emailSent: false, telegramSent: false };
  }

  const member = group.members.find(
    (m) => m.id === asId(payment.memberId)
  );
  const store = await db();
  const user = member?.userId ? await store.getUser(member.userId) : null;

  const periodId = period.id;
  const groupId = group.id;
  const memberId = asId(payment.memberId);
  const portalToken = await createMemberPortalToken(memberId, groupId);
  const portalUrl = await getMemberPortalUrl(portalToken);
  const confirmUrl = `${portalUrl}?pay=${periodId}&open=confirm`;

  const paymentLink = group.payment?.link ?? null;
  const currency = period.currency || "€";
  const effectiveAmount =
    (payment as StorageMemberPayment).adjustedAmount ?? payment.amount;
  const adjustmentReason = (payment as StorageMemberPayment).adjustmentReason ?? null;
  const priceNote = period.priceNote ?? null;

  const unsubscribeUrl =
    sendEmail && member
      ? await getUnsubscribeUrl(
          await createUnsubscribeToken(
            asId(payment.memberId),
            group.id
          )
        )
      : null;

  const reminderTemplateParams = {
    memberName: payment.memberNickname,
    groupName: group.name,
    periodLabel: period.periodLabel,
    amount: effectiveAmount,
    currency,
    paymentPlatform: group.payment?.platform ?? "custom",
    paymentLink,
    paymentInstructions: group.payment?.instructions ?? null,
    confirmUrl,
    ownerName: "the admin",
    extraText: group.announcements?.extraText ?? null,
    adjustmentReason,
    priceNote,
    unsubscribeUrl,
    accentColor: group.service?.accentColor ?? null,
    theme: group.service?.emailTheme ?? "clean",
  };

  const emailHtml = buildPaymentReminderEmailHtml(reminderTemplateParams);

  const emailParams =
    group.notifications?.saveEmailParams === true
      ? {
          template: "payment_reminder" as const,
          ...reminderTemplateParams,
        }
      : undefined;

  const keyboard = paymentConfirmationKeyboard(
    period.id,
    asId(payment.memberId)
  );

  const result = await sendNotification(
    {
      email: payment.memberEmail,
      telegramChatId: user?.telegram?.chatId,
      userId: user?.id,
      recipientLabel: getRecipientLabel({
        memberId,
        memberEmail: payment.memberEmail,
        memberNickname: payment.memberNickname,
        memberUserId: user?.id ?? member?.userId ?? null,
      }),
      preferences: {
        email: sendEmail,
        telegram: sendTelegram,
      },
    },
    {
      type: "payment_reminder",
      subject: `Pay your ${group.service?.name ?? "subscription"} share — ${period.periodLabel}`,
      emailHtml,
      telegramText: buildPaymentReminderTelegramText({
        memberName: payment.memberNickname,
        groupName: group.name,
        periodLabel: period.periodLabel,
        amount: effectiveAmount,
        currency,
        paymentLink,
        adjustmentReason,
        priceNote,
      }),
      telegramKeyboard: keyboard,
      groupId: group.id,
      billingPeriodId: periodId,
      emailParams,
    }
  );

  return {
    emailSent: result.email.sent,
    telegramSent: result.telegram.sent,
  };
}
