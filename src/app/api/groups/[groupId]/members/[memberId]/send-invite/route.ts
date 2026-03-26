import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildGroupInviteEmailHtml,
  buildGroupInviteTelegramText,
} from "@/lib/email/templates/group-invite";
import { getBot } from "@/lib/telegram/bot";
import { sendNotification } from "@/lib/notifications/service";
import {
  createInviteAcceptToken,
  createInviteLinkToken,
  createUnsubscribeToken,
  getUnsubscribeUrl,
} from "@/lib/tokens";
import { getSetting } from "@/lib/settings/service";
import { db, isStorageId, type StorageGroup, type StorageGroupMember } from "@/lib/storage";

function buildBillingSummary(group: StorageGroup): string {
  const { billing } = group;
  const cycle = billing.cycleType === "yearly" ? "year" : "month";
  const price = `${billing.currentPrice} ${billing.currency}`;
  if (billing.mode === "equal_split") {
    return `${price} per ${cycle}, equal split`;
  }
  if (billing.mode === "fixed_amount" && billing.fixedMemberAmount != null) {
    return `${billing.fixedMemberAmount} ${billing.currency} per member per ${cycle}`;
  }
  return `${price} per ${cycle} (variable)`;
}

function isPublicAppUrl(appUrl: string | null): boolean {
  if (!appUrl || !appUrl.trim()) return false;
  const u = appUrl.trim().toLowerCase();
  return !u.startsWith("http://localhost") && !u.startsWith("https://localhost");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId, memberId } = await context.params;
  if (!isStorageId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }
  if (!memberId?.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid member id" } },
      { status: 400 }
    );
  }

  const store = await db();
  const group = await store.getGroupWithMemberUsers(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.adminId !== session.user.id) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the group admin can send invite emails",
        },
      },
      { status: 403 }
    );
  }

  const member = group.members.find(
    (m: StorageGroupMember) =>
      m.id === memberId.trim() && m.isActive && !m.leftAt
  );
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Member not found" } },
      { status: 404 }
    );
  }

  const appUrl = await getSetting("general.appUrl");
  const isPublic = isPublicAppUrl(appUrl);
  const normalizedAppUrl = appUrl?.trim() || null;
  const appBaseUrl = normalizedAppUrl || new URL(request.url).origin;

  let telegramBotUsername: string | null = null;
  try {
    const bot = await getBot();
    const me = await bot.api.getMe();
    telegramBotUsername = me.username ?? null;
  } catch {
    // telegram not configured or getMe failed
  }

  const admin = await store.getUser(group.adminId);
  const adminName = admin?.name ?? "The group admin";
  const billingSummary = buildBillingSummary(group);
  const groupIdStr = group.id;
  const sendEmail = !member.unsubscribedFromEmail;

  let telegramChatId: number | null = null;
  let preferences = { email: sendEmail, telegram: false };
  if (member.userId) {
    const user = await store.getUser(member.userId);
    if (user) {
      telegramChatId = user.telegram?.chatId ?? null;
      preferences = {
        email: sendEmail && (user.notificationPreferences?.email ?? true),
        telegram: user.notificationPreferences?.telegram ?? false,
      };
    }
  }

  const unsubscribeUrl = sendEmail
    ? await getUnsubscribeUrl(
        await createUnsubscribeToken(member.id, groupIdStr)
      )
    : null;

  let telegramInviteLink: string | null = null;
  if (telegramBotUsername) {
    const inviteToken = await createInviteLinkToken(member.id, groupIdStr, 7);
    telegramInviteLink = `https://t.me/${telegramBotUsername}?start=invite_${inviteToken}`;
  }
  const acceptInviteToken = await createInviteAcceptToken(member.id, groupIdStr, 14);
  const acceptInviteUrl = `${appBaseUrl.replace(/\/$/, "")}/api/invite/accept/${acceptInviteToken}`;

  const params = {
    memberName: member.nickname,
    groupName: group.name,
    groupId: groupIdStr,
    serviceName: group.service.name,
    adminName,
    billingSummary,
    paymentPlatform: group.payment.platform,
    paymentLink: group.payment.link ?? null,
    paymentInstructions: group.payment.instructions ?? null,
    isPublic,
    appUrl: normalizedAppUrl,
    telegramBotUsername,
    telegramInviteLink,
    acceptInviteUrl,
    unsubscribeUrl,
    accentColor: group.service?.accentColor ?? null,
    theme: group.service?.emailTheme ?? "clean",
  };

  const subject = `You've been added to ${group.name}`;
  const emailHtml = buildGroupInviteEmailHtml(params);
  const telegramText = buildGroupInviteTelegramText(params);

  const emailParams =
    group.notifications?.saveEmailParams === true
      ? { template: "group_invite" as const, ...params }
      : undefined;

  try {
    const result = await sendNotification(
      {
        email: member.email,
        telegramChatId,
        userId: member.userId ?? null,
        preferences,
      },
      {
        type: "invite",
        subject,
        emailHtml,
        telegramText,
        groupId: groupIdStr,
        emailParams,
      }
    );
    const sent = result.email.sent || result.telegram.sent;
    return NextResponse.json({
      data: { sent, email: result.email.sent, telegram: result.telegram.sent },
    });
  } catch (error) {
    console.error(`send-invite failed for ${member.email}:`, error);
    return NextResponse.json(
      {
        error: {
          code: "SEND_FAILED",
          message: "Failed to send invite notification",
        },
      },
      { status: 500 }
    );
  }
}
