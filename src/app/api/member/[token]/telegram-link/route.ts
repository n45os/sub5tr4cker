import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongoose";
import { getSetting } from "@/lib/settings/service";
import { getBot } from "@/lib/telegram/bot";
import { verifyMemberPortalToken } from "@/lib/tokens";
import { Group, User } from "@/models";
import type { IGroupMember } from "@/models";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const payload = await verifyMemberPortalToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
      { status: 401 },
    );
  }

  await dbConnect();

  const group = await Group.findById(payload.groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 },
    );
  }

  const member = group.members.find(
    (m: IGroupMember) =>
      m._id.toString() === payload.memberId && m.isActive && !m.leftAt,
  );
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Member not found" } },
      { status: 404 },
    );
  }

  // member needs a user account to link Telegram
  if (!member.user) {
    return NextResponse.json(
      {
        error: {
          code: "PRECONDITION_FAILED",
          message: "You need a registered account to link Telegram. Sign up first.",
        },
      },
      { status: 412 },
    );
  }

  const botToken = await getSetting("telegram.botToken");
  if (!botToken) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Telegram is not configured" } },
      { status: 503 },
    );
  }

  try {
    const bot = await getBot();
    const me = await bot.api.getMe();
    const username = me.username || "sub5tr4ckerBot";
    const code = crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await User.findByIdAndUpdate(member.user, {
      $set: { telegramLinkCode: { code, expiresAt } },
    });

    const deepLink = `https://t.me/${username}?start=link_${code}`;

    return NextResponse.json({
      data: { botUsername: username, deepLink },
    });
  } catch (error) {
    console.error("member telegram link error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate link" } },
      { status: 500 },
    );
  }
}
