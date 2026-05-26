export type SettingsCategory =
  | "general"
  | "email"
  | "telegram"
  | "notifications"
  | "security"
  | "cron"
  | "legal"
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
    description:
      "Public base URL of this deployment (scheme + host, no trailing slash). Used for links in emails, Telegram deep links, redirects, and Telegram webhook registration. Wrong value means broken links or callbacks for users.",
    isSecret: false,
    envVar: "APP_URL",
    defaultValue: "http://localhost:3054",
  },
  {
    key: "email.enabled",
    category: "email",
    label: "Enable email notifications",
    description:
      "Master switch for the email channel. Turn this off when this workspace should not send invites, reminders, or tests by email.",
    isSecret: false,
    envVar: "EMAIL_ENABLED",
    defaultValue: "true",
  },
  {
    key: "email.apiKey",
    category: "email",
    label: "Resend API key",
    description:
      "Resend API key for sending transactional mail (reminders, confirmations, invites). Required for email channel; without it, email sends fail.",
    isSecret: true,
    envVar: "RESEND_API_KEY",
  },
  {
    key: "email.fromAddress",
    category: "email",
    label: "From address",
    description:
      "Sender shown on outgoing mail (e.g. SubsTrack <noreply@yourdomain.com>). Must be a domain or address Resend lets you send from.",
    isSecret: false,
    envVar: "EMAIL_FROM",
    defaultValue: "sub5tr4cker <noreply@example.com>",
  },
  {
    key: "email.replyToAddress",
    category: "email",
    label: "Reply-to address",
    description:
      "Optional. When set, replies from members go here instead of the From address. Leave empty if you do not want a separate reply inbox.",
    isSecret: false,
    envVar: "EMAIL_REPLY_TO",
  },
  {
    key: "telegram.enabled",
    category: "telegram",
    label: "Enable Telegram notifications",
    description:
      "Master switch for the Telegram channel. Turn this off when this workspace should not send Telegram reminders, nudges, or tests.",
    isSecret: false,
    envVar: "TELEGRAM_ENABLED",
    defaultValue: "true",
  },
  {
    key: "telegram.botToken",
    category: "telegram",
    label: "Telegram bot token",
    description:
      "Token from @BotFather. The app uses it to call Telegram (send messages, set webhook). Treat like a password; anyone with it can impersonate your bot.",
    isSecret: true,
    envVar: "TELEGRAM_BOT_TOKEN",
  },
  {
    key: "telegram.webhookSecret",
    category: "telegram",
    label: "Telegram webhook secret",
    description:
      "Optional but recommended in production. Telegram sends this on webhook requests; the app checks it so random clients cannot POST fake updates to your webhook URL.",
    isSecret: true,
    envVar: "TELEGRAM_WEBHOOK_SECRET",
  },
  {
    key: "notifications.aggregateReminders",
    category: "notifications",
    label: "Aggregate automated reminders by user",
    description:
      "When on, cron-driven reminders group all unpaid lines per member email into one message. Dashboard “Notify all unpaid” always sends one combined reminder per member email regardless of this toggle.",
    isSecret: false,
    envVar: "AGGREGATE_REMINDERS",
    defaultValue: "false",
  },
  {
    key: "security.confirmationSecret",
    category: "security",
    label: "Confirmation token secret",
    description:
      "Server-only key used to HMAC-sign payment confirmation and related links (e.g. “I paid”, magic login, invite accept). Keeps tokens unforgeable. If you change it, tokens already sent in old emails stop validating.",
    isSecret: true,
    envVar: "CONFIRMATION_SECRET",
  },
  {
    key: "security.telegramLinkSecret",
    category: "security",
    label: "Telegram link secret",
    description:
      "Signs short-lived tokens in “link my Telegram” and similar URLs. If unset, the app falls back to the confirmation secret so one secret can cover both. Rotate independently if you want Telegram link URLs invalidated without touching email confirmation links.",
    isSecret: true,
    envVar: "TELEGRAM_LINK_SECRET",
  },
  {
    key: "security.cronSecret",
    category: "cron",
    label: "Cron secret",
    description:
      "Your scheduler (cron, GitHub Actions, etc.) must send header x-cron-secret with this value when POSTing to /api/cron/* routes. Stops anonymous internet traffic from running billing, reminder enqueue, or the notification worker.",
    isSecret: true,
    envVar: "CRON_SECRET",
  },
  {
    key: "legal.entityName",
    category: "legal",
    label: "Legal entity / operator name",
    description:
      "Name of the person or organisation that runs this deployment. This is the data controller shown on the Privacy Policy, Cookie Policy, and Terms pages. Leave empty to show a generic placeholder.",
    isSecret: false,
    envVar: "LEGAL_ENTITY_NAME",
  },
  {
    key: "legal.contactEmail",
    category: "legal",
    label: "Privacy contact email",
    description:
      "Where users send privacy questions and data-subject requests (access, deletion, etc.). Shown on the legal pages. Use a mailbox you actually monitor.",
    isSecret: false,
    envVar: "LEGAL_CONTACT_EMAIL",
  },
  {
    key: "legal.contactAddress",
    category: "legal",
    label: "Postal address",
    description:
      "Optional postal/registered address of the operator. Some regimes (e.g. GDPR) expect a contactable address for the controller. Leave empty to omit it from the legal pages.",
    isSecret: false,
    envVar: "LEGAL_CONTACT_ADDRESS",
  },
  {
    key: "legal.jurisdiction",
    category: "legal",
    label: "Governing law / jurisdiction",
    description:
      "Country or region whose law governs these terms and where the operator is established (e.g. \"Greece\", \"the European Union\"). Used in the Terms and in the international-transfers note.",
    isSecret: false,
    envVar: "LEGAL_JURISDICTION",
  },
  {
    key: "legal.supervisoryAuthority",
    category: "legal",
    label: "Supervisory authority",
    description:
      "Optional. The data protection authority users can complain to (e.g. \"the Hellenic Data Protection Authority (HDPA)\"). Shown in the GDPR rights section. Leave empty for a generic reference.",
    isSecret: false,
    envVar: "LEGAL_SUPERVISORY_AUTHORITY",
  },
  {
    key: "legal.hostingProvider",
    category: "legal",
    label: "Hosting provider / data location",
    description:
      "Optional. Where this instance and its database are hosted (e.g. \"Hetzner, Germany\"). Used in the data-storage and international-transfers sections. Leave empty to show a generic note.",
    isSecret: false,
    envVar: "LEGAL_HOSTING_PROVIDER",
  },
  {
    key: "legal.lastUpdated",
    category: "legal",
    label: "Policy last-updated date",
    description:
      "Optional ISO date (YYYY-MM-DD) shown as the effective/last-updated date on the legal pages. Update it whenever you change these policies. Leave empty to show today's date.",
    isSecret: false,
    envVar: "LEGAL_LAST_UPDATED",
  },
];

export const settingsDefinitionMap = new Map(
  settingsDefinitions.map((definition) => [definition.key, definition])
);

export function getSettingsDefinition(key: string) {
  return settingsDefinitionMap.get(key) ?? null;
}
