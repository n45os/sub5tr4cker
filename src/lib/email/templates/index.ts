import {
  adminFollowUpSampleParams,
  buildAdminFollowUpEmailHtml,
  buildAdminFollowUpTelegramText,
} from "@/lib/email/templates/admin-follow-up";
import {
  buildPaymentReminderEmailHtml,
  buildPaymentReminderTelegramText,
  paymentReminderSampleParams,
} from "@/lib/email/templates/payment-reminder";
import {
  buildPriceChangeEmailHtml,
  buildPriceChangeTelegramText,
  priceChangeSampleParams,
} from "@/lib/email/templates/price-change";

export type NotificationTemplateType =
  | "payment_reminder"
  | "admin_confirmation_request"
  | "price_change";

export interface NotificationTemplatePreview {
  type: NotificationTemplateType;
  name: string;
  description: string;
  subject: string;
  channels: Array<"email" | "telegram">;
  variables: string[];
  emailHtml: string;
  telegramText: string;
}

export function getNotificationTemplatePreview(
  type: NotificationTemplateType
): NotificationTemplatePreview | null {
  switch (type) {
    case "payment_reminder":
      return {
        type,
        name: "Payment reminder",
        description:
          "Reminder sent to members when a billing period is unpaid after the grace window.",
        subject: `Pay your share — ${paymentReminderSampleParams.periodLabel}`,
        channels: ["email", "telegram"],
        variables: [
          "memberName",
          "groupName",
          "periodLabel",
          "amount",
          "currency",
          "paymentPlatform",
          "paymentLink",
          "confirmUrl",
          "extraText",
        ],
        emailHtml: buildPaymentReminderEmailHtml(paymentReminderSampleParams),
        telegramText: buildPaymentReminderTelegramText(paymentReminderSampleParams),
      };
    case "admin_confirmation_request":
      return {
        type,
        name: "Admin confirmation request",
        description:
          "Notification sent to the group owner when members mark their payment as completed.",
        subject: `Verify payments for ${adminFollowUpSampleParams.groupName}`,
        channels: ["email", "telegram"],
        variables: ["groupName", "periodLabel", "currency", "unverifiedMembers"],
        emailHtml: buildAdminFollowUpEmailHtml(adminFollowUpSampleParams),
        telegramText: buildAdminFollowUpTelegramText(adminFollowUpSampleParams),
      };
    case "price_change":
      return {
        type,
        name: "Price change announcement",
        description:
          "Announcement sent when the group price changes and members need to be informed ahead of the next cycle.",
        subject: `Price update: ${priceChangeSampleParams.groupName}`,
        channels: ["email", "telegram"],
        variables: [
          "groupName",
          "serviceName",
          "oldPrice",
          "newPrice",
          "currency",
        ],
        emailHtml: buildPriceChangeEmailHtml(priceChangeSampleParams),
        telegramText: buildPriceChangeTelegramText(priceChangeSampleParams),
      };
    default:
      return null;
  }
}

export function getNotificationTemplates() {
  return [
    getNotificationTemplatePreview("payment_reminder"),
    getNotificationTemplatePreview("admin_confirmation_request"),
    getNotificationTemplatePreview("price_change"),
  ].filter((template): template is NotificationTemplatePreview => template !== null);
}
