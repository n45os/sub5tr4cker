import { buildAdminFollowUpEmailHtml } from "@/lib/email/templates/admin-follow-up";
import {
  buildAggregatedPaymentReminderEmailHtml,
  type AggregatedPaymentReminderTemplateParams,
} from "@/lib/email/templates/aggregated-payment-reminder";
import {
  buildGroupInviteEmailHtml,
  buildTelegramWelcomeEmailHtml,
  type GroupInviteTemplateParams,
  type TelegramWelcomeTemplateParams,
} from "@/lib/email/templates/group-invite";
import {
  buildPaymentReminderEmailHtml,
  type PaymentReminderTemplateParams,
} from "@/lib/email/templates/payment-reminder";
import { buildPriceAdjustmentEmailHtml } from "@/lib/email/templates/price-adjustment";
import { buildPriceChangeEmailHtml } from "@/lib/email/templates/price-change";

/** discriminant stored in Notification.emailParams.template */
export type SavedEmailTemplate =
  | "payment_reminder"
  | "aggregated_payment_reminder"
  | "admin_follow_up"
  | "price_change"
  | "price_adjustment"
  | "group_invite"
  | "telegram_welcome";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** rebuild HTML from persisted template params (same builders as send path) */
export function buildEmailHtmlFromSavedParams(
  emailParams: Record<string, unknown>
): string {
  const template = emailParams.template;
  if (template === "payment_reminder") {
    const p = emailParams as unknown as PaymentReminderTemplateParams & {
      template?: string;
    };
    const { template: _t, ...rest } = p;
    return buildPaymentReminderEmailHtml(rest);
  }
  if (template === "aggregated_payment_reminder") {
    const p = emailParams as unknown as AggregatedPaymentReminderTemplateParams & {
      template?: string;
    };
    const { template: _t, ...rest } = p;
    return buildAggregatedPaymentReminderEmailHtml(rest);
  }
  if (template === "admin_follow_up") {
    const { template: _t, ...rest } = emailParams as Record<string, unknown> & {
      template?: string;
    };
    return buildAdminFollowUpEmailHtml(
      rest as unknown as Parameters<typeof buildAdminFollowUpEmailHtml>[0]
    );
  }
  if (template === "price_change") {
    const { template: _t, ...rest } = emailParams as Record<string, unknown> & {
      template?: string;
    };
    return buildPriceChangeEmailHtml(
      rest as unknown as Parameters<typeof buildPriceChangeEmailHtml>[0]
    );
  }
  if (template === "price_adjustment") {
    const { template: _t, ...rest } = emailParams as Record<string, unknown> & {
      template?: string;
    };
    return buildPriceAdjustmentEmailHtml(
      rest as unknown as Parameters<typeof buildPriceAdjustmentEmailHtml>[0]
    );
  }
  if (template === "group_invite") {
    const { template: _t, ...rest } = emailParams as Record<string, unknown> & {
      template?: string;
    };
    return buildGroupInviteEmailHtml(rest as unknown as GroupInviteTemplateParams);
  }
  if (template === "telegram_welcome") {
    const { template: _t, ...rest } = emailParams as Record<string, unknown> & {
      template?: string;
    };
    return buildTelegramWelcomeEmailHtml(
      rest as unknown as TelegramWelcomeTemplateParams
    );
  }
  throw new Error(
    `unknown email template: ${String(template)}`
  );
}

export function isValidSavedEmailParams(
  emailParams: unknown
): emailParams is Record<string, unknown> & { template: SavedEmailTemplate } {
  if (!isRecord(emailParams)) return false;
  const t = emailParams.template;
  return (
    t === "payment_reminder" ||
    t === "aggregated_payment_reminder" ||
    t === "admin_follow_up" ||
    t === "price_change" ||
    t === "price_adjustment" ||
    t === "group_invite" ||
    t === "telegram_welcome"
  );
}
