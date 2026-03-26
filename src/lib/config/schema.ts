import { z } from "zod";

// ── config schema ─────────────────────────────────────────────────────────────

export const sub5tr4ckerConfigSchema = z.object({
  /** schema version for migration support */
  configVersion: z.string().default("1.0.0"),

  /** operating mode */
  mode: z.enum(["local", "advanced"]).default("local"),

  /** app version at time of creation */
  appVersion: z.string().default("unknown"),

  /** port for the web UI */
  port: z.number().int().min(1024).max(65535).default(3054),

  /** auto-generated auth token for local single-user mode */
  authToken: z.string().optional(),

  /** email address of the local admin (used in local mode UI) */
  adminEmail: z.string().email().optional(),

  /** admin display name */
  adminName: z.string().optional(),

  notifications: z.object({
    channels: z.object({
      email: z
        .object({
          provider: z.literal("resend"),
          apiKey: z.string(),
          fromAddress: z.string(),
          replyToAddress: z.string().optional(),
        })
        .optional(),
      telegram: z
        .object({
          botToken: z.string(),
          pollingEnabled: z.boolean().default(true),
          /** last processed update_id from Telegram polling */
          lastUpdateId: z.number().int().optional(),
        })
        .optional(),
    }),
    defaultChannel: z.enum(["email", "telegram"]).default("email"),
  }).default({
    channels: {},
    defaultChannel: "email",
  }),

  /** cron/scheduling state */
  cron: z.object({
    installed: z.boolean().default(false),
    method: z.enum(["crontab", "launchd", "task-scheduler", "manual"]).optional(),
    interval: z.string().default("*/30 * * * *"),
  }).default({
    installed: false,
    interval: "*/30 * * * *",
  }),

  /** only used in advanced mode */
  mongodb: z
    .object({
      uri: z.string(),
    })
    .optional(),
});

export type Sub5tr4ckerConfig = z.infer<typeof sub5tr4ckerConfigSchema>;

/** keys that map to settings service keys for use by getSetting() in local mode */
export const CONFIG_TO_SETTING_KEY: Record<string, string> = {
  "email.apiKey": "notifications.channels.email.apiKey",
  "email.fromAddress": "notifications.channels.email.fromAddress",
  "email.replyToAddress": "notifications.channels.email.replyToAddress",
  "telegram.botToken": "notifications.channels.telegram.botToken",
};
