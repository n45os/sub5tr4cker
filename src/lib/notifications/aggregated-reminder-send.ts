import { User } from "@/models";
import type { IGroup } from "@/models";
import type { IBillingPeriod, IMemberPayment } from "@/models/billing-period";
import { sendNotification } from "@/lib/notifications/service";
import { paymentConfirmationKeyboard } from "@/lib/telegram/keyboards";
import {
  getConfirmationUrl,
  createUnsubscribeToken,
  getUnsubscribeUrl,
} from "@/lib/tokens";
import type { AggregatedPaymentEntry } from "@/lib/email/templates/aggregated-payment-reminder";
import {
  buildAggregatedPaymentReminderEmailHtml,
  buildAggregatedPaymentReminderTelegramText,
} from "@/lib/email/templates/aggregated-payment-reminder";

export interface SendAggregatedReminderResult {
  emailSent: boolean;
  telegramSent: boolean;
}

export type ChannelOverride = "email" | "telegram" | "both";

type GroupDoc = IGroup & {
  _id: { toString: () => string };
  name: string;
  service?: { name?: string; accentColor?: string | null } | null;
  payment?: { platform?: string; link?: string | null } | null;
  members: IGroup["members"];
};

type PeriodDoc = IBillingPeriod & {
  _id: { toString: () => string };
  periodLabel: string;
  currency: string;
  priceNote: string | null;
  payments: IMemberPayment[];
};

export interface AggregatedPaymentInput {
  group: GroupDoc;
  period: PeriodDoc;
  payment: IMemberPayment;
}

/** send one combined reminder for a user (same email) across multiple groups; respects user prefs */
export async function sendAggregatedReminder(
  memberEmail: string,
  memberName: string,
  payments: AggregatedPaymentInput[],
  options?: { channelOverride?: ChannelOverride }
): Promise<SendAggregatedReminderResult> {
  if (payments.length === 0) {
    return { emailSent: false, telegramSent: false };
  }

  const { dbConnect } = await import("@/lib/db/mongoose");
  await dbConnect();

  const user = await User.findOne({ email: memberEmail })
    .select("telegram notificationPreferences")
    .lean()
    .exec();

  const sendEmail = user?.notificationPreferences?.email ?? true;
  const sendTelegram = !!(
    user?.telegram?.chatId &&
    (user.notificationPreferences?.telegram ?? false)
  );
  let wantEmail = sendEmail;
  let wantTelegram = sendTelegram;
  if (options?.channelOverride === "email") wantTelegram = false;
  if (options?.channelOverride === "telegram") wantEmail = false;
  if (!wantEmail && !wantTelegram) {
    return { emailSent: false, telegramSent: false };
  }

  const entries: AggregatedPaymentEntry[] = [];
  for (const { group, period, payment } of payments) {
    const confirmUrl = payment.confirmationToken
      ? await getConfirmationUrl(payment.confirmationToken)
      : null;
    const effectiveAmount = payment.adjustedAmount ?? payment.amount;
    entries.push({
      groupName: group.name,
      serviceName: group.service?.name ?? "subscription",
      periodLabel: period.periodLabel,
      amount: effectiveAmount,
      currency: period.currency || "€",
      paymentPlatform: group.payment?.platform ?? "custom",
      paymentLink: group.payment?.link ?? null,
      confirmUrl,
      adjustmentReason: payment.adjustmentReason ?? null,
      priceNote: period.priceNote ?? null,
      accentColor: group.service?.accentColor ?? null,
    });
  }

  const distinctGroupCount = new Set(
    payments.map((i) => (i.group._id as { toString: () => string }).toString())
  ).size;
  const distinctPeriodCount = new Set(
    payments.map((i) => (i.period._id as { toString: () => string }).toString())
  ).size;

  const first = payments[0];
  const firstMemberId = (first.payment.memberId as { toString: () => string }).toString();
  const firstGroupId = (first.group._id as { toString: () => string }).toString();
  const unsubscribeUrl = wantEmail
    ? await getUnsubscribeUrl(
        await createUnsubscribeToken(firstMemberId, firstGroupId)
      )
    : null;

  const accentColor = entries[0]?.accentColor ?? null;
  const emailHtml = buildAggregatedPaymentReminderEmailHtml({
    memberName,
    entries,
    distinctGroupCount,
    distinctPeriodCount,
    unsubscribeUrl,
    accentColor,
  });

  const telegramText = buildAggregatedPaymentReminderTelegramText({
    memberName,
    entries,
    distinctGroupCount,
    distinctPeriodCount,
  });

  const firstPeriodId = (first.period._id as { toString: () => string }).toString();
  const keyboard = paymentConfirmationKeyboard(firstPeriodId, firstMemberId);

  const result = await sendNotification(
    {
      email: memberEmail,
      telegramChatId: user?.telegram?.chatId ?? null,
      userId: user?._id?.toString() ?? null,
      preferences: {
        email: wantEmail,
        telegram: wantTelegram,
      },
    },
    {
      type: "payment_reminder",
      subject:
        distinctGroupCount > 1
          ? `Payment reminders — ${distinctPeriodCount} period(s), ${distinctGroupCount} groups`
          : `Payment reminders — ${distinctPeriodCount} period(s)`,
      emailHtml,
      telegramText,
      telegramKeyboard: keyboard,
      groupId: firstGroupId,
      billingPeriodId: firstPeriodId,
    }
  );

  return {
    emailSent: result.email.sent,
    telegramSent: result.telegram.sent,
  };
}
