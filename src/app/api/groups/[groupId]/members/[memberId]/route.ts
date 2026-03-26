import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
  backfillMemberIntoPeriods,
  recalculateEqualSplitPeriodsForGroup,
  recalculatePeriodsOnMemberRemoval,
} from "@/lib/billing/backfill";
import { calculateShares, getNextPeriodStart } from "@/lib/billing/calculator";
import { db, isStorageId, type StorageGroupMember } from "@/lib/storage";

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
  if (!isStorageId(groupId) || !isStorageId(memberId)) {
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
      { error: { code: "FORBIDDEN", message: "Only the admin can update members" } },
      { status: 403 }
    );
  }

  const memberIndex = group.members.findIndex((m) => m.id === memberId);
  if (memberIndex === -1) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Member not found" } },
      { status: 404 }
    );
  }

  const memberBefore = group.members[memberIndex]!;
  const previousBillingStart = memberBefore.billingStartsAt;

  const body = parsed.data;
  const updatedMember: StorageGroupMember = { ...memberBefore };

  if (body.nickname !== undefined) updatedMember.nickname = body.nickname;
  if ("customAmount" in (body || {})) updatedMember.customAmount = body.customAmount ?? null;
  if (body.isActive !== undefined) updatedMember.isActive = body.isActive;
  if ("billingStartsAt" in (body || {})) {
    const v = body.billingStartsAt;
    if (v === null || v === "") {
      updatedMember.billingStartsAt = null;
    } else {
      const d = new Date(v as string);
      if (!Number.isNaN(d.getTime())) updatedMember.billingStartsAt = d;
    }
  }

  const members = group.members.map((m, i) => (i === memberIndex ? updatedMember : m));
  await store.updateGroup(groupId, { members });

  let groupForBackfill = (await store.getGroup(groupId))!;
  const member = groupForBackfill.members.find((m) => m.id === memberId)!;

  // backfill into past periods when billingStartsAt moved earlier
  let backfilledPeriods = 0;
  const newBillingStart = member.billingStartsAt;
  if (
    newBillingStart &&
    (!previousBillingStart || newBillingStart < previousBillingStart) &&
    newBillingStart < new Date()
  ) {
    const result = await backfillMemberIntoPeriods(groupForBackfill, member);
    backfilledPeriods = result.backfilledCount;
  }

  if (
    backfilledPeriods > 0 &&
    (groupForBackfill.billing.mode === "equal_split" ||
      groupForBackfill.billing.mode === "variable")
  ) {
    const fresh = await store.getGroup(groupId);
    if (fresh) {
      await recalculateEqualSplitPeriodsForGroup(fresh);
    }
    groupForBackfill = (await store.getGroup(groupId))!;
    const m2 = groupForBackfill.members.find((m) => m.id === memberId)!;
    Object.assign(member, m2);
  }

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
    metadata: { nickname: member.nickname, backfilledPeriods },
  });

  return NextResponse.json({
    data: {
      _id: member.id,
      email: member.email,
      nickname: member.nickname,
      role: member.role,
      isActive: member.isActive,
      customAmount: member.customAmount,
      billingStartsAt: member.billingStartsAt
        ? member.billingStartsAt.toISOString().slice(0, 10)
        : null,
      backfilledPeriods,
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
  if (!isStorageId(groupId) || !isStorageId(memberId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or member id" } },
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
      { error: { code: "FORBIDDEN", message: "Only the admin can remove members" } },
      { status: 403 }
    );
  }

  const memberIndex = group.members.findIndex((m) => m.id === memberId);
  if (memberIndex === -1) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Member not found" } },
      { status: 404 }
    );
  }

  const memberBefore = group.members[memberIndex]!;
  const removedSnapshot: StorageGroupMember = {
    ...memberBefore,
    leftAt: new Date(),
    isActive: false,
  };

  const members = group.members.map((m, i) => (i === memberIndex ? removedSnapshot : m));
  await store.updateGroup(groupId, { members });

  const groupAfterRemoval = (await store.getGroup(groupId))!;

  // recalculate pending period amounts now that this member is inactive
  const recalcResult = await recalculatePeriodsOnMemberRemoval(groupAfterRemoval, removedSnapshot);

  // compute the new share for the next upcoming period
  let newShareAmount = recalcResult.newShareAmount;
  if (!newShareAmount) {
    const nextStart = getNextPeriodStart(groupAfterRemoval.billing.cycleDay ?? 1);
    const shares = calculateShares(
      groupAfterRemoval,
      groupAfterRemoval.billing.currentPrice,
      nextStart
    );
    newShareAmount = shares.length > 0 ? shares[0].amount : 0;
  }

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
    metadata: { nickname: memberBefore.nickname, email: memberBefore.email },
  });

  return NextResponse.json({
    data: {
      success: true,
      newShareAmount,
      currency: groupAfterRemoval.billing.currency,
      recalculatedCount: recalcResult.recalculatedCount,
      removedMemberPendingPeriods: recalcResult.removedMemberPendingPeriods,
    },
  });
}
