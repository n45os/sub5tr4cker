import { User } from "@/models";
import type { IGroup } from "@/models";
import type { IBillingPeriod } from "@/models/billing-period";
import { sendNotification } from "@/lib/notifications/service";
import { getReminderEligibility, type PaymentLike } from "@/lib/notifications/reminder-targeting";
import { paymentConfirmationKeyboard } from "@/lib/telegram/keyboards";
import {
  getConfirmationUrl,
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

/** send a single payment reminder (respects eligibility; no-op if no channel reachable) */
export async function sendReminderForPayment(
  group: GroupDoc,
  period: PeriodDoc,
  payment: PaymentLike
): Promise<SendReminderResult> {
  const eligibility = await getReminderEligibility({ group, period, payment });
  if (!eligibility.sendEmail && !eligibility.sendTelegram) {
    return { emailSent: false, telegramSent: false };
  }

  const member = group.members.find(
    (m: { _id: { toString: () => string } }) =>
      m._id.toString() === payment.memberId.toString()
  );
  const user = member?.user ? await User.findById(member.user) : null;

  const confirmUrl = payment.confirmationToken
    ? await getConfirmationUrl(payment.confirmationToken)
    : null;

  const paymentLink = group.payment?.link ?? null;
  const currency = period.currency || "€";

  const unsubscribeUrl =
    eligibility.sendEmail && member
      ? await getUnsubscribeUrl(
          await createUnsubscribeToken(
            payment.memberId.toString(),
            (group._id as { toString: () => string }).toString()
          )
        )
      : null;

  const emailHtml = buildPaymentReminderEmailHtml({
    memberName: payment.memberNickname,
    groupName: group.name,
    periodLabel: period.periodLabel,
    amount: payment.amount,
    currency,
    paymentPlatform: group.payment?.platform ?? "custom",
    paymentLink,
    confirmUrl,
    ownerName: "the admin",
    extraText: group.announcements?.extraText ?? null,
    unsubscribeUrl,
    accentColor: group.service?.accentColor ?? null,
  });

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
        email: eligibility.sendEmail,
        telegram: eligibility.sendTelegram,
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
        amount: payment.amount,
        currency,
        paymentLink,
      }),
      telegramKeyboard: keyboard,
      groupId: (group._id as { toString: () => string }).toString(),
      billingPeriodId: (period._id as { toString: () => string }).toString(),
    }
  );

  return {
    emailSent: result.email.sent,
    telegramSent: result.telegram.sent,
  };
}
