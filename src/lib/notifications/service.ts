import { sendEmail } from "@/lib/email/client";
import { sendTelegramMessage } from "@/lib/telegram/send";
import { isTelegramEnabled } from "@/lib/telegram/bot";
import { InlineKeyboard } from "grammy";
import { dbConnect } from "@/lib/db/mongoose";
import { Notification, NotificationType } from "@/models";
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
