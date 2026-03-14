import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";

const updateMemberSchema = z
  .object({
    nickname: z.string().min(1).max(100).optional(),
    customAmount: z.number().positive().optional().nullable(),
    isActive: z.boolean().optional(),
    // date string (YYYY-MM-DD or ISO) or null to use joinedAt
    billingStartsAt: z
      .union([z.string().min(1), z.null(), z.literal("")])
      .optional()
      .nullable()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
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
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(memberId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or member id" } },
      { status: 400 }
    );
  }

  const parsed = updateMemberSchema.safeParse(await request.json());
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

  await dbConnect();
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can update members" } },
      { status: 403 }
    );
  }

  const member = group.members.id(memberId);
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Member not found" } },
      { status: 404 }
    );
  }

  const body = parsed.data;
  if (body.nickname !== undefined) member.nickname = body.nickname;
  if ("customAmount" in (body || {})) member.customAmount = body.customAmount ?? null;
  if (body.isActive !== undefined) member.isActive = body.isActive;
  if ("billingStartsAt" in (body || {})) {
    const v = body.billingStartsAt;
    if (v === null || v === "") {
      member.billingStartsAt = null;
    } else {
      const d = new Date(v as string);
      if (!Number.isNaN(d.getTime())) member.billingStartsAt = d;
    }
  }

  await group.save();

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "member_updated",
    groupId,
    targetMemberId: memberId,
    metadata: { nickname: member.nickname },
  });

  return NextResponse.json({
    data: {
      _id: member._id.toString(),
      email: member.email,
      nickname: member.nickname,
      role: member.role,
      isActive: member.isActive,
      customAmount: member.customAmount,
      billingStartsAt: member.billingStartsAt ? (member.billingStartsAt as Date).toISOString().slice(0, 10) : null,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
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
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(memberId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or member id" } },
      { status: 400 }
    );
  }

  await dbConnect();
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can remove members" } },
      { status: 403 }
    );
  }

  const member = group.members.id(memberId);
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Member not found" } },
      { status: 404 }
    );
  }

  member.leftAt = new Date();
  member.isActive = false;
  await group.save();

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "member_removed",
    groupId,
    targetMemberId: memberId,
    metadata: { nickname: member.nickname, email: member.email },
  });

  return NextResponse.json({ data: { success: true } });
}
