import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, User } from "@/models";
import type { IGroupMember } from "@/models";
import { getSetting } from "@/lib/settings/service";
import {
  verifyInviteAcceptToken,
  createMagicLoginToken,
  createMemberPortalToken,
  getMemberPortalUrl,
  createInviteLinkToken,
  createUnsubscribeToken,
  getUnsubscribeUrl,
} from "@/lib/tokens";
import { sendNotification } from "@/lib/notifications/service";
import { buildTelegramWelcomeEmailHtml } from "@/lib/email/templates/group-invite";
import { getBot, isTelegramEnabled } from "@/lib/telegram/bot";

function buildBillingSummary(group: {
  billing: {
    cycleType: "monthly" | "yearly";
    currentPrice: number;
    currency: string;
    mode: "equal_split" | "fixed_amount" | "variable";
    fixedMemberAmount?: number | null;
  };
}): string {
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
    const appUrl = (await getSetting("general.appUrl")) || fallbackAppUrl;

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

    await dbConnect();
    const group = await Group.findById(payload.groupId);
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
      (m: IGroupMember) =>
        m._id.toString() === payload.memberId && m.isActive && !m.leftAt
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

    // atomic find-or-create: avoids duplicate key races on telegramLinkCode
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $setOnInsert: {
          name: nickname || normalizedEmail,
          email: normalizedEmail,
          hashedPassword: null,
          notificationPreferences: {
            email: true,
            telegram: false,
            reminderFrequency: "every_3_days",
          },
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    await Group.updateOne(
      { _id: group._id, "members._id": member._id },
      {
        $set: {
          "members.$.user": user._id,
          "members.$.acceptedAt": new Date(),
        },
      }
    );

    const groupIdStr = group._id.toString();
    const memberPortalToken = await createMemberPortalToken(
      member._id.toString(),
      groupIdStr
    );
    const memberPortalUrl = await getMemberPortalUrl(memberPortalToken);

    // send welcome email at most once per user (atomic claim so repeat visits don't resend)
    const baseUrl = appUrl.replace(/\/$/, "");
    const claimed = await User.findOneAndUpdate(
      { _id: user._id, welcomeEmailSentAt: null },
      { $set: { welcomeEmailSentAt: new Date() } }
    );
    if (claimed) {
      void (async () => {
        try {
          const magicToken = await createMagicLoginToken(user._id.toString());
          const magicLoginUrl = `${baseUrl}/invite-callback?token=${encodeURIComponent(magicToken)}&groupId=${encodeURIComponent(payload.groupId)}`;
          const sendEmail = !member.unsubscribedFromEmail;
          const unsubscribeUrl = sendEmail
            ? await getUnsubscribeUrl(
                await createUnsubscribeToken(
                  member._id.toString(),
                  groupIdStr
                )
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
                const inviteToken = await createInviteLinkToken(
                  member._id.toString(),
                  groupIdStr,
                  7
                );
                telegramInviteLink = `https://t.me/${telegramBotUsername}?start=invite_${inviteToken}`;
              }
            } catch {
              // telegram not configured, skip
            }
          }

          const admin = await User.findById(group.admin);
          const emailHtml = buildTelegramWelcomeEmailHtml({
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
            appUrl: appUrl?.trim() || null,
            telegramBotUsername,
            telegramInviteLink,
            unsubscribeUrl,
            accentColor: group.service?.accentColor ?? null,
            theme: group.service?.emailTheme ?? "clean",
            // template still uses this prop name, but it now points to the member portal
            magicLoginUrl: memberPortalUrl,
          });

          await sendNotification(
            {
              email: user.email,
              telegramChatId: null,
              userId: user._id.toString(),
              preferences: { email: sendEmail, telegram: false },
            },
            {
              type: "invite",
              subject: `Welcome to ${group.name} — your member page`,
              emailHtml,
              telegramText: `Welcome to ${group.name}`,
              groupId: groupIdStr,
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
