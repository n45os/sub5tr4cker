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
  buildGroupInviteEmailHtml,
  buildGroupInviteTelegramText,
  groupInviteSampleParams,
} from "@/lib/email/templates/group-invite";
import {
  buildPriceChangeEmailHtml,
  buildPriceChangeTelegramText,
  priceChangeSampleParams,
} from "@/lib/email/templates/price-change";

export type NotificationTemplateType =
  | "payment_reminder"
  | "admin_confirmation_request"
  | "price_change"
  | "invite";

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
          "accentColor",
        ],
        emailHtml: buildPaymentReminderEmailHtml({
          ...paymentReminderSampleParams,
          accentColor: "#3b82f6",
        }),
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
        variables: ["groupName", "periodLabel", "currency", "unverifiedMembers", "accentColor"],
        emailHtml: buildAdminFollowUpEmailHtml({
          ...adminFollowUpSampleParams,
          accentColor: "#3b82f6",
        }),
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
          "accentColor",
        ],
        emailHtml: buildPriceChangeEmailHtml({
          ...priceChangeSampleParams,
          accentColor: "#3b82f6",
        }),
        telegramText: buildPriceChangeTelegramText(priceChangeSampleParams),
      };
    case "invite":
      return {
        type,
        name: "Group invite",
        description:
          "Welcome email sent to members when the admin initializes and notifies the group.",
        subject: `You've been added to ${groupInviteSampleParams.groupName}`,
        channels: ["email", "telegram"],
        variables: [
          "memberName",
          "groupName",
          "groupId",
          "serviceName",
          "adminName",
          "billingSummary",
          "paymentPlatform",
          "paymentLink",
          "paymentInstructions",
          "isPublic",
          "appUrl",
          "telegramBotUsername",
          "accentColor",
        ],
        emailHtml: buildGroupInviteEmailHtml({
          ...groupInviteSampleParams,
          accentColor: "#3b82f6",
        }),
        telegramText: buildGroupInviteTelegramText(groupInviteSampleParams),
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
    getNotificationTemplatePreview("invite"),
  ].filter((template): template is NotificationTemplatePreview => template !== null);
}
