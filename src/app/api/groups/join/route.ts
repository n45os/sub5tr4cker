import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db, type StorageGroupMember } from "@/lib/storage";

const joinSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
  email: z.string().trim().email().nullable(),
  nickname: z.string().min(1).max(100),
});

/**
 * Public endpoint: join a group via invite code (no auth).
 * Creates a new member with userId: null. Rejects if already an active member.
 */
export async function POST(request: NextRequest) {
  const parsed = joinSchema.safeParse(await request.json().catch(() => null));
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

  const store = await db();
  const group = await store.findGroupByInviteCode(code);
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

  const normalizedEmail = email?.trim().toLowerCase() || null;
  const existing = normalizedEmail
    ? group.members.find(
        (m: StorageGroupMember) =>
          !!m.email &&
          m.email.toLowerCase() === normalizedEmail &&
          m.isActive &&
          !m.leftAt
      )
    : null;
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

  const newMember: StorageGroupMember = {
    id: nanoid(),
    userId: null,
    email: normalizedEmail,
    nickname,
    customAmount: null,
    role: "member",
    isActive: true,
    leftAt: null,
    joinedAt: new Date(),
    acceptedAt: null,
    unsubscribedFromEmail: false,
    billingStartsAt: null,
  };

  const updatedGroup = await store.updateGroup(group.id, {
    members: [...group.members, newMember],
  });

  // the adapter may assign its own id for the new member (mongo ObjectId),
  // so resolve the persisted member instead of trusting the pre-generated id
  const existingIds = new Set(group.members.map((m: StorageGroupMember) => m.id));
  const persistedMember =
    updatedGroup.members.find((m: StorageGroupMember) => !existingIds.has(m.id)) ?? newMember;

  return NextResponse.json({
    data: {
      groupId: group.id,
      member: {
        _id: persistedMember.id,
        email: persistedMember.email,
        nickname: persistedMember.nickname,
        role: persistedMember.role,
        isActive: persistedMember.isActive,
      },
    },
  });
}
