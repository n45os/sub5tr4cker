import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, User } from "@/models";
import type { IGroupMember } from "@/models";
import { verifyMemberPortalToken } from "@/lib/tokens";
import { sendNotification } from "@/lib/notifications/service";

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  subject: z.string().max(200).optional(),
  memberToken: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await context.params;
  if (!mongoose.isValidObjectId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 },
    );
  }

  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  await dbConnect();

  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 },
    );
  }

  const { message, subject, memberToken } = parsed.data;

  // identify the member - either via auth session or portal token
  let memberNickname: string | null = null;
  let memberEmail: string | null = null;

  if (memberToken) {
    const payload = await verifyMemberPortalToken(memberToken);
    if (!payload || payload.groupId !== groupId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid token" } },
        { status: 401 },
      );
    }
    const member = group.members.find(
      (m: IGroupMember) => m._id.toString() === payload.memberId && m.isActive,
    );
    if (!member) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Member not found" } },
        { status: 404 },
      );
    }
    memberNickname = member.nickname;
    memberEmail = member.email;
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }
    const member = group.members.find(
      (m: IGroupMember) =>
        (m.user && m.user.toString() === session.user!.id) ||
        (m.email === session.user!.email),
    );
    if (!member) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not a member of this group" } },
        { status: 403 },
      );
    }
    memberNickname = member.nickname;
    memberEmail = member.email;
  }

  // load admin to send notification
  const admin = await User.findById(group.admin).lean();
  if (!admin) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Admin not found" } },
      { status: 500 },
    );
  }

  const subjectLine = subject || `Message from ${memberNickname}`;
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="background: #3b82f6; color: #fff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">Message from member</h1>
        </div>
        <div style="padding: 24px;">
          <p><strong>${memberNickname}</strong> (${memberEmail}) sent a message about <strong>${group.name}</strong>:</p>
          <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin: 16px 0; white-space: pre-wrap;">${message}</div>
          <p style="color: #94a3b8; font-size: 12px;">Reply directly to this member at ${memberEmail}.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const telegramText =
    `📩 <b>Member message</b>\n\n` +
    `<b>${memberNickname}</b> (${memberEmail})\n` +
    `Group: <b>${group.name}</b>\n\n` +
    `${message}`;

  type AdminUser = {
    email?: string;
    telegram?: { chatId?: number | null };
    notificationPreferences?: { email?: boolean; telegram?: boolean };
  };
  const typedAdmin = admin as AdminUser;

  await sendNotification(
    {
      email: typedAdmin.email || "",
      telegramChatId: typedAdmin.telegram?.chatId ?? null,
      preferences: {
        email: typedAdmin.notificationPreferences?.email ?? true,
        telegram: typedAdmin.notificationPreferences?.telegram ?? false,
      },
    },
    {
      type: "member_message",
      subject: subjectLine,
      emailHtml,
      telegramText,
      groupId,
    },
  );

  return NextResponse.json({
    data: { sent: true },
  });
}
