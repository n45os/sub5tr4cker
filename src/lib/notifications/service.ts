import { sendEmail } from "@/lib/email/client";
import { sendTelegramMessage } from "@/lib/telegram/send";
import { isTelegramEnabled } from "@/lib/telegram/bot";
import { buildPriceChangeEmailHtml } from "@/lib/email/templates/price-change";
import { InlineKeyboard } from "grammy";
import { dbConnect } from "@/lib/db/mongoose";
import { Notification, NotificationType, User } from "@/models";
import type { IGroup } from "@/models";
import { Types } from "mongoose";

interface NotificationTarget {
  email: string;
  telegramChatId?: number | null;
  userId?: string | null;
  preferences?: {
    email: boolean;
    telegram: boolean;
  };
}

interface NotificationContent {
  type: NotificationType;
  subject: string;
  emailHtml: string;
  telegramText: string;
  telegramKeyboard?: InlineKeyboard;
  groupId?: string;
  billingPeriodId?: string;
}

interface NotificationResult {
  email: { sent: boolean; id?: string };
  telegram: { sent: boolean; messageId?: number };
}

// send a notification through all configured channels
export async function sendNotification(
  target: NotificationTarget,
  content: NotificationContent
): Promise<NotificationResult> {
  await dbConnect();

  const result: NotificationResult = {
    email: { sent: false },
    telegram: { sent: false },
  };

  const shouldSendEmail = target.preferences?.email !== false;
  const shouldSendTelegram =
    target.preferences?.telegram !== false &&
    target.telegramChatId &&
    isTelegramEnabled();

  // send email
  if (shouldSendEmail && target.email) {
    const emailResult = await sendEmail({
      to: target.email,
      subject: content.subject,
      html: content.emailHtml,
    });

    result.email.sent = !!emailResult;
    result.email.id = emailResult?.id;

    await logNotification({
      recipientEmail: target.email,
      recipientId: target.userId,
      channel: "email",
      type: content.type,
      subject: content.subject,
      preview: content.subject,
      status: emailResult ? "sent" : "failed",
      externalId: emailResult?.id,
      groupId: content.groupId,
      billingPeriodId: content.billingPeriodId,
    });
  }

  // send telegram
  if (shouldSendTelegram && target.telegramChatId) {
    const messageId = await sendTelegramMessage({
      chatId: target.telegramChatId,
      text: content.telegramText,
      keyboard: content.telegramKeyboard,
    });

    result.telegram.sent = !!messageId;
    result.telegram.messageId = messageId ?? undefined;

    await logNotification({
      recipientEmail: target.email,
      recipientId: target.userId,
      channel: "telegram",
      type: content.type,
      subject: null,
      preview: content.telegramText.substring(0, 100),
      status: messageId ? "sent" : "failed",
      externalId: messageId?.toString(),
      groupId: content.groupId,
      billingPeriodId: content.billingPeriodId,
    });
  }

  return result;
}

async function logNotification(params: {
  recipientEmail: string;
  recipientId?: string | null;
  channel: "email" | "telegram";
  type: NotificationType;
  subject: string | null;
  preview: string;
  status: "sent" | "failed";
  externalId?: string | null;
  groupId?: string;
  billingPeriodId?: string;
}): Promise<void> {
  try {
    await Notification.create({
      recipient: params.recipientId
        ? new Types.ObjectId(params.recipientId)
        : null,
      recipientEmail: params.recipientEmail,
      group: params.groupId ? new Types.ObjectId(params.groupId) : null,
      billingPeriod: params.billingPeriodId
        ? new Types.ObjectId(params.billingPeriodId)
        : null,
      type: params.type,
      channel: params.channel,
      status: params.status,
      subject: params.subject,
      preview: params.preview,
      externalId: params.externalId ?? null,
      deliveredAt: params.status === "sent" ? new Date() : null,
    });
  } catch (error) {
    // don't let logging failures break the notification flow
    console.error("failed to log notification:", error);
  }
}

// notification target for price-change (email + optional telegram/prefs)
type PriceChangeTarget = {
  email: string;
  telegramChatId?: number | null;
  userId?: string | null;
  preferences?: { email: boolean; telegram: boolean };
};

// send price-change announcements to admin and all active members when group price is updated
export async function sendPriceChangeAnnouncements(
  group: IGroup,
  params: {
    previousPrice: number;
    newPrice: number;
    currency: string;
    serviceName: string;
  }
): Promise<void> {
  if (!group.announcements?.notifyOnPriceChange) return;

  await dbConnect();

  const { previousPrice, newPrice, currency, serviceName } = params;
  const groupName = group.name;
  const subject = `Price update: ${groupName} (${serviceName})`;
  const emailHtml = buildPriceChangeEmailHtml({
    groupName,
    serviceName,
    oldPrice: previousPrice,
    newPrice,
    currency,
  });
  const telegramText =
    `📢 <b>Price update</b>\n\n` +
    `<b>${groupName}</b> (${serviceName})\n\n` +
    `Previous: <s>${previousPrice.toFixed(2)}${currency}</s>\n` +
    `New: <b>${newPrice.toFixed(2)}${currency}</b>\n\n` +
    `Your next billing cycle will use the new amount.`;

  const targets = new Map<string, PriceChangeTarget>();

  const admin = await User.findById(group.admin);
  if (admin) {
    targets.set(admin.email.toLowerCase(), {
      email: admin.email,
      telegramChatId: admin.telegram?.chatId ?? null,
      userId: admin._id.toString(),
      preferences: {
        email: admin.notificationPreferences?.email ?? true,
        telegram: admin.notificationPreferences?.telegram ?? false,
      },
    });
  }

  for (const member of group.members) {
    if (!member.isActive || member.leftAt) continue;
    const key = member.email.toLowerCase();
    if (targets.has(key)) continue;

    if (member.user) {
      const user = await User.findById(member.user);
      if (user) {
        targets.set(key, {
          email: user.email,
          telegramChatId: user.telegram?.chatId ?? null,
          userId: user._id.toString(),
          preferences: {
            email: user.notificationPreferences?.email ?? true,
            telegram: user.notificationPreferences?.telegram ?? false,
          },
        });
        continue;
      }
    }

    targets.set(key, {
      email: member.email,
      telegramChatId: null,
      userId: null,
      preferences: { email: true, telegram: false },
    });
  }

  const groupId = group._id.toString();
  for (const target of targets.values()) {
    try {
      await sendNotification(target, {
        type: "price_change",
        subject,
        emailHtml,
        telegramText,
        groupId,
      });
    } catch (error) {
      console.error(
        `price-change notification failed for ${target.email}:`,
        error
      );
    }
  }
}
