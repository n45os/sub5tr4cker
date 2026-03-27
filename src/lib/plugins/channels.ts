import { InlineKeyboard } from "grammy";
import { sendEmail } from "@/lib/email/client";
import { sendTelegramMessage } from "@/lib/telegram/send";
import { isTelegramEnabled } from "@/lib/telegram/bot";
import { getPluginChannels } from "./loader";
import { getSetting } from "@/lib/settings/service";

export interface ChannelSendMessage {
  subject: string;
  emailHtml: string;
  telegramText: string;
  telegramKeyboard?: InlineKeyboard;
}

export interface ChannelSendTarget {
  email?: string | null;
  telegramChatId?: number | null;
  userId?: string | null;
  preferences?: { email?: boolean; telegram?: boolean };
}

export interface ChannelSendResult {
  sent: boolean;
  /** when true, channel was not applicable (no link, pref off, etc.) — do not log as failed */
  skipped?: boolean;
  externalId?: string | null;
}

export interface NotificationChannel {
  id: string;
  name: string;
  isBuiltIn: boolean;
  send: (
    target: ChannelSendTarget,
    message: ChannelSendMessage,
    context?: { groupId?: string; billingPeriodId?: string }
  ) => Promise<ChannelSendResult>;
}

function createEmailChannel(): NotificationChannel {
  return {
    id: "email",
    name: "Email",
    isBuiltIn: true,
    async send(target, message) {
      const enabled = (await getSetting("email.enabled")) !== "false";
      if (!enabled || !target.email || target.preferences?.email === false) {
        return { sent: false, skipped: true };
      }
      const result = await sendEmail({
        to: target.email,
        subject: message.subject,
        html: message.emailHtml,
      });
      return { sent: !!result, externalId: result?.id ?? null };
    },
  };
}

function createTelegramChannel(): NotificationChannel {
  return {
    id: "telegram",
    name: "Telegram",
    isBuiltIn: true,
    async send(target, message) {
      const enabled =
        (await getSetting("telegram.enabled")) !== "false" &&
        (await isTelegramEnabled());
      if (
        !enabled ||
        !target.telegramChatId ||
        target.preferences?.telegram === false
      ) {
        return { sent: false, skipped: true };
      }
      const messageId = await sendTelegramMessage({
        chatId: target.telegramChatId,
        text: message.telegramText,
        keyboard: message.telegramKeyboard,
      });
      return { sent: !!messageId, externalId: messageId?.toString() ?? null };
    },
  };
}

function createPluginChannels(): NotificationChannel[] {
  const registrations = getPluginChannels();
  const channels: NotificationChannel[] = [];

  for (const reg of registrations) {
    channels.push({
      id: `plugin:${reg.pluginSlug}:${reg.id}`,
      name: reg.name,
      isBuiltIn: false,
      async send(target, message, context) {
        try {
          const config: Record<string, string | number | boolean> = {};
          if (reg.entry.configSchema) {
            for (const key of Object.keys(reg.entry.configSchema)) {
              const value = await getSetting(
                `plugin.${reg.pluginSlug}.${key}`
              );
              if (value != null) config[key] = value;
            }
          }
          const mod = require(reg.resolvedFile);
          const sendFn = mod.send ?? mod.default?.send;
          if (typeof sendFn !== "function") return { sent: false };
          const result = await sendFn(config, {
            subject: message.subject,
            html: message.emailHtml,
            text: message.telegramText,
          });
          return {
            sent: !!result?.sent,
            externalId: result?.externalId ?? null,
          };
        } catch {
          return { sent: false };
        }
      },
    });
  }

  return channels;
}

let cachedChannels: NotificationChannel[] | null = null;

export function getChannels(): NotificationChannel[] {
  if (cachedChannels) return cachedChannels;
  cachedChannels = [
    createEmailChannel(),
    createTelegramChannel(),
    ...createPluginChannels(),
  ];
  return cachedChannels;
}

export function clearChannelsCache(): void {
  cachedChannels = null;
}

export function getBuiltInChannelIds(): Set<string> {
  return new Set(["email", "telegram"]);
}
