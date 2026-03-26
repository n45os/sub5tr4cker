import { NextResponse } from "next/server";
import { isPublicAppUrl, normalizeAppUrl } from "@/lib/public-app-url";
import { getSetting } from "@/lib/settings/service";
import {
  verifyInviteAcceptToken,
  createMemberPortalToken,
  getMemberPortalUrl,
  createInviteLinkToken,
  createUnsubscribeToken,
  getUnsubscribeUrl,
} from "@/lib/tokens";
import { sendNotification } from "@/lib/notifications/service";
import { buildTelegramWelcomeEmailHtml } from "@/lib/email/templates/group-invite";
import { getBot, isTelegramEnabled } from "@/lib/telegram/bot";
import { db, type StorageGroup, type StorageGroupMember } from "@/lib/storage";

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

function buildHtml(title: string, message: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 48px auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 24px; }
    h1 { margin-top: 0; font-size: 22px; color: #111827; }
    p { color: #374151; line-height: 1.5; }
    a { display: inline-block; margin-top: 12px; background: #111827; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${appUrl.replace(/\/$/, "")}/dashboard">Open sub5tr4cker</a>
  </div>
</body>
</html>`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const fallbackAppUrl = new URL(request.url).origin;
  try {
    const { token } = await context.params;
    const appUrl = normalizeAppUrl(await getSetting("general.appUrl")) || fallbackAppUrl;

    const payload = await verifyInviteAcceptToken(token);
    if (!payload) {
      return new NextResponse(
        buildHtml(
          "Invite link invalid",
          "This invite link has expired or is invalid. Ask the group admin to send a new invite email.",
          appUrl
        ),
        { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    const store = await db();
    const group = await store.getGroup(payload.groupId);
    if (!group || !group.isActive) {
      return new NextResponse(
        buildHtml(
          "Invite not available",
          "This group is no longer available.",
          appUrl
        ),
        { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    const member = group.members.find(
      (m: StorageGroupMember) =>
        m.id === payload.memberId && m.isActive && !m.leftAt
    );
    if (!member) {
      return new NextResponse(
        buildHtml(
          "Invite not available",
          "This invitation is no longer active.",
          appUrl
        ),
        { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    const rawEmail = typeof member.email === "string" ? member.email.trim() : "";
    if (!rawEmail) {
      return new NextResponse(
        buildHtml(
          "Invite unavailable",
          "This invite is missing an email address. Ask the group admin to resend your invite.",
          appUrl
        ),
        { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    const normalizedEmail = rawEmail.toLowerCase();
    const nickname =
      typeof member.nickname === "string" ? member.nickname.trim() : "";

    let user = await store.getUserByEmail(normalizedEmail);
    if (!user) {
      user = await store.createUser({
        name: nickname || normalizedEmail,
        email: normalizedEmail,
        role: "user",
        hashedPassword: null,
        notificationPreferences: {
          email: true,
          telegram: false,
          reminderFrequency: "every_3_days",
        },
      });
    }

    const members = group.members.map((m) =>
      m.id === member.id
        ? { ...m, userId: user.id, acceptedAt: new Date() }
        : m
    );
    await store.updateGroup(group.id, { members });

    const groupIdStr = group.id;
    const memberPortalToken = await createMemberPortalToken(member.id, groupIdStr);
    const memberPortalUrl = await getMemberPortalUrl(memberPortalToken);

    const freshUser = await store.getUser(user.id);
    const shouldSendWelcome = freshUser && !freshUser.welcomeEmailSentAt;
    if (shouldSendWelcome) {
      await store.updateUser(user.id, { welcomeEmailSentAt: new Date() });
      void (async () => {
        try {
          const sendEmail = !member.unsubscribedFromEmail;
          const unsubscribeUrl = sendEmail
            ? await getUnsubscribeUrl(
                await createUnsubscribeToken(member.id, groupIdStr)
              )
            : null;

          let telegramBotUsername: string | null = null;
          let telegramInviteLink: string | null = null;
          if (await isTelegramEnabled()) {
            try {
              const bot = await getBot();
              const me = await bot.api.getMe();
              telegramBotUsername = me.username ?? null;
              if (telegramBotUsername) {
                const inviteToken = await createInviteLinkToken(member.id, groupIdStr, 7);
                telegramInviteLink = `https://t.me/${telegramBotUsername}?start=invite_${inviteToken}`;
              }
            } catch {
              // telegram not configured, skip
            }
          }

          const admin = await store.getUser(group.adminId);
          const telegramWelcomeParams = {
            memberName: member.nickname,
            groupName: group.name,
            groupId: groupIdStr,
            serviceName: group.service.name,
            adminName: admin?.name ?? "The group admin",
            billingSummary: buildBillingSummary(group),
            paymentPlatform: group.payment.platform,
            paymentLink: group.payment.link ?? null,
            paymentInstructions: group.payment.instructions ?? null,
            isPublic: isPublicAppUrl(appUrl),
            appUrl: normalizeAppUrl(appUrl),
            telegramBotUsername,
            telegramInviteLink,
            unsubscribeUrl,
            accentColor: group.service?.accentColor ?? null,
            theme: group.service?.emailTheme ?? "clean",
            magicLoginUrl: memberPortalUrl,
          };
          const emailHtml = buildTelegramWelcomeEmailHtml(telegramWelcomeParams);
          const emailParams =
            group.notifications?.saveEmailParams === true
              ? {
                  template: "telegram_welcome" as const,
                  ...telegramWelcomeParams,
                }
              : undefined;

          await sendNotification(
            {
              email: user.email,
              telegramChatId: null,
              userId: user.id,
              preferences: { email: sendEmail, telegram: false },
            },
            {
              type: "invite",
              subject: `Welcome to ${group.name} — your member page`,
              emailHtml,
              telegramText: `Welcome to ${group.name}`,
              groupId: groupIdStr,
              emailParams,
            }
          );
        } catch (emailError) {
          console.error("invite accept welcome email failed:", emailError);
        }
      })();
    }

    return NextResponse.redirect(new URL(`${memberPortalUrl}?joined=true`), 302);
  } catch (error) {
    console.error("invite accept handler failed:", error);
    return new NextResponse(
      buildHtml(
        "Invite unavailable",
        "We couldn't process this invite right now. Please try again or ask the group admin to resend your invite.",
        fallbackAppUrl
      ),
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
}
