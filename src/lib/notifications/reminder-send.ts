import { User } from "@/models";
import type { IGroup } from "@/models";
import type { IBillingPeriod, IMemberPayment } from "@/models/billing-period";
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

export interface SendReminderResult {
  emailSent: boolean;
  telegramSent: boolean;
}

type GroupDoc = IGroup & { _id: { toString: () => string }; members: IGroup["members"] };
type PeriodDoc = IBillingPeriod & { _id: { toString: () => string }; periodLabel: string; currency: string };

export type ChannelOverride = "email" | "telegram" | "both";

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
    (m: { _id: { toString: () => string } }) =>
      m._id.toString() === payment.memberId.toString()
  );
  const user = member?.user ? await User.findById(member.user) : null;

  const periodId = (period._id as { toString: () => string }).toString();
  const groupId = (group._id as { toString: () => string }).toString();
  const memberId = payment.memberId.toString();
  const portalToken = await createMemberPortalToken(memberId, groupId);
  const portalUrl = await getMemberPortalUrl(portalToken);
  const confirmUrl = `${portalUrl}?pay=${periodId}&open=confirm`;

  const paymentLink = group.payment?.link ?? null;
  const currency = period.currency || "€";
  const effectiveAmount =
    (payment as IMemberPayment).adjustedAmount ?? payment.amount;
  const adjustmentReason = (payment as IMemberPayment).adjustmentReason ?? null;
  const priceNote = (period as IBillingPeriod).priceNote ?? null;

  const unsubscribeUrl =
    sendEmail && member
      ? await getUnsubscribeUrl(
          await createUnsubscribeToken(
            payment.memberId.toString(),
            (group._id as { toString: () => string }).toString()
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
    (period._id as { toString: () => string }).toString(),
    payment.memberId.toString()
  );

  const result = await sendNotification(
    {
      email: payment.memberEmail,
      telegramChatId: user?.telegram?.chatId,
      userId: user?._id?.toString(),
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
      groupId: (group._id as { toString: () => string }).toString(),
      billingPeriodId: periodId,
      emailParams,
    }
  );

  return {
    emailSent: result.email.sent,
    telegramSent: result.telegram.sent,
  };
}
