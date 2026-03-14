import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, User } from "@/models";
import type { IGroupMember } from "@/models";
import { getSetting } from "@/lib/settings/service";
import {
  verifyInviteAcceptToken,
  createMagicLoginToken,
} from "@/lib/tokens";

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

    const normalizedEmail = (member.email as string).toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await User.create({
        name: (member.nickname as string).trim() || normalizedEmail,
        email: normalizedEmail,
        hashedPassword: null,
        notificationPreferences: {
          email: true,
          telegram: false,
          reminderFrequency: "every_3_days",
        },
      });
    }

    if (!member.user || member.user.toString() !== user._id.toString()) {
      member.user = user._id;
    }
    if (!member.acceptedAt) {
      member.acceptedAt = new Date();
    }
    await group.save();

    const magicToken = await createMagicLoginToken(user._id.toString());
    const baseUrl = appUrl.replace(/\/$/, "");
    const callbackUrl = `${baseUrl}/invite-callback?token=${encodeURIComponent(magicToken)}&groupId=${encodeURIComponent(payload.groupId)}`;
    return NextResponse.redirect(callbackUrl, 302);
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
