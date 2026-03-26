import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBot } from "@/lib/telegram/bot";
import { createInviteLinkToken } from "@/lib/tokens";
import { db, isStorageId, type StorageGroupMember } from "@/lib/storage";

export async function GET(
  _request: Request,
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
  const group = await store.getGroup(groupId);
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
          message: "Only the group admin can generate Telegram invite links",
        },
      },
      { status: 403 }
    );
  }

  const member = group.members.find(
    (item: StorageGroupMember) =>
      item.id === memberId.trim() && item.isActive && !item.leftAt
  );
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Member not found" } },
      { status: 404 }
    );
  }

  try {
    const bot = await getBot();
    const me = await bot.api.getMe();
    const botUsername = me.username ?? "sub5tr4ckerBot";
    const inviteToken = await createInviteLinkToken(member.id, group.id, 7);
    const deepLink = `https://t.me/${botUsername}?start=invite_${inviteToken}`;

    return NextResponse.json({
      data: {
        botUsername,
        deepLink,
        expiresInDays: 7,
      },
    });
  } catch (error) {
    console.error("telegram invite link error:", error);
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Telegram is not configured",
        },
      },
      { status: 503 }
    );
  }
}
