import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";
import type { IGroupMember } from "@/models";

const joinSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
  email: z.string().email(),
  nickname: z.string().min(1).max(100),
});

/**
 * Public endpoint: join a group via invite code (no auth).
 * Creates a new member with user: null. Rejects if already an active member.
 */
export async function POST(request: NextRequest) {
  const parsed = joinSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { inviteCode, email, nickname } = parsed.data;
  const code = inviteCode.trim();

  await dbConnect();
  const group = await Group.findOne({ inviteCode: code });
  if (!group) {
    return NextResponse.json(
      {
        error: {
          code: "INVITE_INVALID",
          message: "Invite link not found or has been revoked",
        },
      },
      { status: 404 }
    );
  }

  if (!group.isActive) {
    return NextResponse.json(
      {
        error: {
          code: "GROUP_INACTIVE",
          message: "This group is no longer active",
        },
      },
      { status: 404 }
    );
  }

  const inviteLinkEnabled = group.inviteLinkEnabled ?? false;
  if (!inviteLinkEnabled || !group.inviteCode) {
    return NextResponse.json(
      {
        error: {
          code: "INVITE_DISABLED",
          message: "Registration via this invite link is currently disabled",
        },
      },
      { status: 403 }
    );
  }

  const existing = group.members.find(
    (m: IGroupMember) =>
      m.email.toLowerCase() === email.toLowerCase() && m.isActive && !m.leftAt
  );
  if (existing) {
    return NextResponse.json(
      {
        error: {
          code: "ALREADY_MEMBER",
          message: "A member with this email already belongs to the group",
        },
      },
      { status: 409 }
    );
  }

  group.members.push({
    email,
    nickname,
    customAmount: null,
    role: "member",
    isActive: true,
    leftAt: null,
    user: null,
  } as never);
  await group.save();

  const added = group.members[group.members.length - 1];
  return NextResponse.json({
    data: {
      groupId: group._id.toString(),
      member: {
        _id: added._id.toString(),
        email: added.email,
        nickname: added.nickname,
        role: added.role,
        isActive: added.isActive,
      },
    },
  });
}
