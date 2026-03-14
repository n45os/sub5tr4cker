export type SettingsCategory =
  | "general"
  | "email"
  | "telegram"
  | "security"
  | "cron"
  | "plugin";

export interface SettingsDefinition {
  key: string;
  category: SettingsCategory;
  label: string;
  description: string;
  isSecret: boolean;
  envVar: string;
  defaultValue?: string;
}

export const settingsDefinitions: SettingsDefinition[] = [
  {
    key: "general.appUrl",
    category: "general",
    label: "App URL",
    description: "Base URL used for links in emails, redirects, and callbacks.",
    isSecret: false,
    envVar: "APP_URL",
    defaultValue: "http://localhost:3054",
  },
  {
    key: "email.apiKey",
    category: "email",
    label: "Resend API key",
    description: "API key used to send transactional emails through Resend.",
    isSecret: true,
    envVar: "RESEND_API_KEY",
  },
  {
    key: "email.fromAddress",
    category: "email",
    label: "From address",
    description: "Default sender shown on outgoing emails.",
    isSecret: false,
    envVar: "EMAIL_FROM",
    defaultValue: "sub5tr4cker <noreply@example.com>",
  },
  {
    key: "telegram.botToken",
    category: "telegram",
    label: "Telegram bot token",
    description: "BotFather token used to receive webhook updates and send messages.",
    isSecret: true,
    envVar: "TELEGRAM_BOT_TOKEN",
  },
  {
    key: "telegram.webhookSecret",
    category: "telegram",
    label: "Telegram webhook secret",
    description: "Secret token used to validate webhook calls from Telegram.",
    isSecret: true,
    envVar: "TELEGRAM_WEBHOOK_SECRET",
  },
  {
    key: "security.confirmationSecret",
    category: "security",
    label: "Confirmation token secret",
    description: "Secret used to sign member payment confirmation links.",
    isSecret: true,
    envVar: "CONFIRMATION_SECRET",
  },
  {
    key: "security.telegramLinkSecret",
    category: "security",
    label: "Telegram link secret",
    description: "Secret used to sign Telegram account-link tokens.",
    isSecret: true,
    envVar: "TELEGRAM_LINK_SECRET",
  },
  {
    key: "security.cronSecret",
    category: "cron",
    label: "Cron secret",
    description: "Shared secret required by protected cron endpoints.",
    isSecret: true,
    envVar: "CRON_SECRET",
  },
];

export const settingsDefinitionMap = new Map(
  settingsDefinitions.map((definition) => [definition.key, definition])
);

export function getSettingsDefinition(key: string) {
  return settingsDefinitionMap.get(key) ?? null;
}
