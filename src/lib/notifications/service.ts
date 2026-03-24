import {
  buildPriceAdjustmentEmailHtml,
  buildPriceAdjustmentTelegramText,
} from "@/lib/email/templates/price-adjustment";
import {
  buildPriceChangeEmailHtml,
  buildPriceChangeTelegramText,
} from "@/lib/email/templates/price-change";
import { InlineKeyboard } from "grammy";
import { dbConnect } from "@/lib/db/mongoose";
import { createUnsubscribeToken, getUnsubscribeUrl } from "@/lib/tokens";
import { Notification, NotificationType, User } from "@/models";
import type { IGroup } from "@/models";
import { Types } from "mongoose";
import { getChannels, getBuiltInChannelIds } from "@/lib/plugins/channels";

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
  /** when set, persisted on the email log row for activity preview (group opt-in) */
  emailParams?: Record<string, unknown>;
}

interface NotificationResult {
  email: { sent: boolean; id?: string };
  telegram: { sent: boolean; messageId?: number };
}

function estimatePerMemberShare(group: IGroup, totalPrice: number): number | null {
  const activeMemberCount = group.members.filter(
    (member) => member.isActive && !member.leftAt
  ).length;
  const splitCount = activeMemberCount + (group.billing.adminIncludedInSplit ? 1 : 0);
  if (splitCount <= 0) return null;
  return totalPrice / splitCount;
}

// send a notification through built-in channels (email, telegram) from the channel registry
export async function sendNotification(
  target: NotificationTarget,
  content: NotificationContent
): Promise<NotificationResult> {
  await dbConnect();

  const result: NotificationResult = {
    email: { sent: false },
    telegram: { sent: false },
  };

  const builtInIds = getBuiltInChannelIds();
  const channels = getChannels().filter((ch) => builtInIds.has(ch.id));

  const message = {
    subject: content.subject,
    emailHtml: content.emailHtml,
    telegramText: content.telegramText,
    telegramKeyboard: content.telegramKeyboard,
  };
  const targetPayload = {
    email: target.email,
    telegramChatId: target.telegramChatId ?? null,
    userId: target.userId ?? null,
    preferences: target.preferences,
  };
  const context = {
    groupId: content.groupId,
    billingPeriodId: content.billingPeriodId,
  };

  for (const channel of channels) {
    const sendResult = await channel.send(targetPayload, message, context);
    const channelKey = channel.id as "email" | "telegram";
    // only log when channel was actually attempted; skip log for inapplicable channels
    const attempted = !sendResult.skipped;
    if (channelKey === "email") {
      result.email.sent = sendResult.sent;
      result.email.id = sendResult.externalId ?? undefined;
      if (attempted) {
        await logNotification({
          recipientEmail: target.email,
          recipientId: target.userId,
          channel: "email",
          type: content.type,
          subject: content.subject,
          preview: content.subject,
          status: sendResult.sent ? "sent" : "failed",
          externalId: sendResult.externalId ?? null,
          groupId: content.groupId,
          billingPeriodId: content.billingPeriodId,
          emailParams: content.emailParams,
        });
      }
    } else if (channelKey === "telegram") {
      result.telegram.sent = sendResult.sent;
      result.telegram.messageId = sendResult.externalId
        ? Number(sendResult.externalId)
        : undefined;
      if (attempted) {
        await logNotification({
          recipientEmail: target.email,
          recipientId: target.userId,
          channel: "telegram",
          type: content.type,
          subject: null,
          preview: content.telegramText.substring(0, 100),
          status: sendResult.sent ? "sent" : "failed",
          externalId: sendResult.externalId ?? null,
          groupId: content.groupId,
          billingPeriodId: content.billingPeriodId,
        });
      }
    }
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
  emailParams?: Record<string, unknown>;
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
      emailParams: params.emailParams ?? null,
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
  /** set for group members; used to build unsubscribe URL and respect unsubscribedFromEmail */
  memberId?: string;
  unsubscribedFromEmail?: boolean;
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
  const oldMemberShare = estimatePerMemberShare(group, previousPrice);
  const newMemberShare = estimatePerMemberShare(group, newPrice);

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

  const groupIdStr = group._id.toString();
  for (const member of group.members) {
    if (!member.isActive || member.leftAt) continue;
    const key = member.email.toLowerCase();
    if (targets.has(key)) continue;

    const sendEmail = !member.unsubscribedFromEmail;
    if (member.user) {
      const user = await User.findById(member.user);
      if (user) {
        targets.set(key, {
          email: user.email,
          telegramChatId: user.telegram?.chatId ?? null,
          userId: user._id.toString(),
          preferences: {
            email: sendEmail && (user.notificationPreferences?.email ?? true),
            telegram: user.notificationPreferences?.telegram ?? false,
          },
          memberId: member._id.toString(),
          unsubscribedFromEmail: member.unsubscribedFromEmail,
        });
        continue;
      }
    }

    targets.set(key, {
      email: member.email,
      telegramChatId: null,
      userId: null,
      preferences: { email: sendEmail, telegram: false },
      memberId: member._id.toString(),
      unsubscribedFromEmail: member.unsubscribedFromEmail,
    });
  }

  for (const target of targets.values()) {
    try {
      const unsubscribeUrl =
        target.memberId && !target.unsubscribedFromEmail
          ? await getUnsubscribeUrl(
              await createUnsubscribeToken(target.memberId, groupIdStr)
            )
          : null;
      const emailHtml = buildPriceChangeEmailHtml({
        groupName,
        serviceName,
        oldPrice: previousPrice,
        newPrice,
        currency,
        oldMemberShare,
        newMemberShare,
        nextPeriodLabel: "next billing cycle",
        unsubscribeUrl,
        accentColor: group.service?.accentColor ?? null,
        theme: group.service?.emailTheme ?? "clean",
      });
      const telegramText = buildPriceChangeTelegramText({
        groupName,
        serviceName,
        oldPrice: previousPrice,
        newPrice,
        currency,
      });
      const emailParams =
        group.notifications?.saveEmailParams === true
          ? {
              template: "price_change" as const,
              groupName,
              serviceName,
              oldPrice: previousPrice,
              newPrice,
              currency,
              oldMemberShare,
              newMemberShare,
              nextPeriodLabel: "next billing cycle",
              unsubscribeUrl,
              accentColor: group.service?.accentColor ?? null,
              theme: group.service?.emailTheme ?? "clean",
            }
          : undefined;
      await sendNotification(
        {
          email: target.email,
          telegramChatId: target.telegramChatId ?? null,
          userId: target.userId ?? null,
          preferences: target.preferences,
        },
        {
          type: "price_change",
          subject,
          emailHtml,
          telegramText,
          groupId: groupIdStr,
          emailParams,
        }
      );
    } catch (error) {
      console.error(
        `price-change notification failed for ${target.email}:`,
        error
      );
    }
  }
}

export interface MemberAddedCreditEntry {
  memberId: string;
  memberNickname: string;
  memberEmail: string;
  totalCredit: number;
  periods: Array<{
    periodId: string;
    periodLabel: string;
    oldAmount: number;
    newAmount: number;
    credit: number;
  }>;
}

// notify existing members when a new member is added (new share amount, optional credit)
export async function sendMemberAddedNotifications(
  group: IGroup,
  params: {
    newMemberId: string;
    newMemberNickname: string;
    newShareAmount: number;
    currency: string;
    changeType?: "added" | "removed";
    creditSummary: MemberAddedCreditEntry[];
  }
): Promise<void> {
  await dbConnect();

  const {
    newMemberId,
    newMemberNickname,
    newShareAmount,
    currency,
    changeType = "added",
    creditSummary,
  } = params;
  const groupName = group.name;
  const groupIdStr = group._id.toString();
  const isRemoval = changeType === "removed";
  const creditByMemberId = new Map(
    creditSummary.map((c) => [c.memberId, c])
  );

  const targets = new Map<string, PriceChangeTarget & { memberNickname: string }>();

  const admin = await User.findById(group.admin);
  if (admin) {
    const adminMember = group.members.find(
      (m) => m.user?.toString() === admin._id.toString()
    );
    const nickname = adminMember?.nickname ?? admin.name ?? "Admin";
    targets.set(admin.email.toLowerCase(), {
      email: admin.email,
      telegramChatId: admin.telegram?.chatId ?? null,
      userId: admin._id.toString(),
      preferences: {
        email: admin.notificationPreferences?.email ?? true,
        telegram: admin.notificationPreferences?.telegram ?? false,
      },
      memberId: adminMember?._id?.toString(),
      memberNickname: nickname,
    });
  }

  for (const member of group.members) {
    if (!member.isActive || member.leftAt) continue;
    if (member._id.toString() === newMemberId) continue;
    const key = member.email.toLowerCase();
    if (targets.has(key)) continue;

    const sendEmail = !member.unsubscribedFromEmail;
    if (member.user) {
      const user = await User.findById(member.user);
      if (user) {
        targets.set(key, {
          email: user.email,
          telegramChatId: user.telegram?.chatId ?? null,
          userId: user._id.toString(),
          preferences: {
            email: sendEmail && (user.notificationPreferences?.email ?? true),
            telegram: user.notificationPreferences?.telegram ?? false,
          },
          memberId: member._id.toString(),
          unsubscribedFromEmail: member.unsubscribedFromEmail,
          memberNickname: member.nickname,
        });
        continue;
      }
    }

    targets.set(key, {
      email: member.email,
      telegramChatId: null,
      userId: null,
      preferences: { email: sendEmail, telegram: false },
      memberId: member._id.toString(),
      unsubscribedFromEmail: member.unsubscribedFromEmail,
      memberNickname: member.nickname,
    });
  }

  const subject = isRemoval
    ? `Member left: ${groupName}`
    : `New member added: ${groupName}`;
  const periodLabel = "your next payment";

  for (const target of targets.values()) {
    try {
      const memberId = target.memberId ?? target.userId;
      const creditEntry = memberId ? creditByMemberId.get(memberId) : null;
      const originalAmount = creditEntry
        ? newShareAmount + creditEntry.totalCredit
        : newShareAmount;
      const difference = creditEntry ? creditEntry.totalCredit : 0;

      let reason: string;
      if (isRemoval) {
        reason = `${newMemberNickname} has left the subscription. Your new share is ${newShareAmount.toFixed(2)} ${currency}.`;
      } else if (creditEntry != null) {
        reason = `${newMemberNickname} joined the subscription. You overpaid on past periods; this credit will be applied to your next payment.`;
      } else {
        reason = `A new member (${newMemberNickname}) was added to the subscription. Your new share is ${newShareAmount.toFixed(2)} ${currency}.`;
      }

      const unsubscribeUrl =
        target.memberId && !target.unsubscribedFromEmail
          ? await getUnsubscribeUrl(
              await createUnsubscribeToken(target.memberId, groupIdStr)
            )
          : null;

      const emailHtml = buildPriceAdjustmentEmailHtml({
        memberName: target.memberNickname,
        groupName,
        periodLabel,
        originalAmount,
        newAmount: newShareAmount,
        difference,
        currency,
        reason,
        paymentLink: null,
        paymentInstructions: null,
        confirmUrl: null,
        isCredit: difference > 0,
        unsubscribeUrl,
        accentColor: group.service?.accentColor ?? null,
        theme: group.service?.emailTheme ?? "clean",
      });
      const telegramText = buildPriceAdjustmentTelegramText({
        memberName: target.memberNickname,
        groupName,
        periodLabel,
        originalAmount,
        newAmount: newShareAmount,
        difference,
        currency,
        reason,
        paymentLink: null,
        isCredit: difference > 0,
      });

      const emailParams =
        group.notifications?.saveEmailParams === true
          ? {
              template: "price_adjustment" as const,
              memberName: target.memberNickname,
              groupName,
              periodLabel,
              originalAmount,
              newAmount: newShareAmount,
              difference,
              currency,
              reason,
              paymentLink: null,
              paymentInstructions: null,
              confirmUrl: null,
              isCredit: difference > 0,
              unsubscribeUrl,
              accentColor: group.service?.accentColor ?? null,
              theme: group.service?.emailTheme ?? "clean",
            }
          : undefined;

      await sendNotification(
        {
          email: target.email,
          telegramChatId: target.telegramChatId ?? null,
          userId: target.userId ?? null,
          preferences: target.preferences,
        },
        {
          type: "price_adjustment",
          subject,
          emailHtml,
          telegramText,
          groupId: groupIdStr,
          emailParams,
        }
      );
    } catch (error) {
      console.error(
        `member-added notification failed for ${target.email}:`,
        error
      );
    }
  }
}
