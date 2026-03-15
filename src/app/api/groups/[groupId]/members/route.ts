import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { backfillMemberIntoPeriods } from "@/lib/billing/backfill";
import { calculateShares, getNextPeriodStart } from "@/lib/billing/calculator";
import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";
import type { IGroupMember } from "@/models";

const addMemberSchema = z.object({
  email: z.string().email(),
  nickname: z.string().min(1).max(100),
  customAmount: z.number().positive().optional().nullable(),
  billingStartsAt: z.string().optional().nullable(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  if (!mongoose.isValidObjectId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }

  const parsed = addMemberSchema.safeParse(await request.json());
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
      { error: { code: "FORBIDDEN", message: "Only the admin can add members" } },
      { status: 403 }
    );
  }

  const { email, nickname, customAmount, billingStartsAt } = parsed.data;
  const existing = group.members.find(
    (m: IGroupMember) =>
      m.email.toLowerCase() === email.toLowerCase() && m.isActive && !m.leftAt
  );
  if (existing) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "A member with this email already belongs to the group",
        },
      },
      { status: 409 }
    );
  }

  const memberData: Record<string, unknown> = {
    email,
    nickname,
    customAmount: customAmount ?? null,
    role: "member",
    isActive: true,
    leftAt: null,
    user: null,
  };
  if (billingStartsAt) {
    const d = new Date(billingStartsAt);
    if (!Number.isNaN(d.getTime())) memberData.billingStartsAt = d;
  }

  group.members.push(memberData as never);
  await group.save();

  const added = group.members[group.members.length - 1];

  // backfill into existing periods when billing starts in the past
  let backfilledPeriods = 0;
  let creditSummary: Array<{
    memberId: string;
    memberNickname: string;
    memberEmail: string;
    totalCredit: number;
    periods: Array<{
      periodId: string;
      periodLabel: string;
      oldAmount: number;
      newAmount: number;
      credit: number;
    }>;
  }> = [];
  if (added.billingStartsAt && added.billingStartsAt < new Date()) {
    const result = await backfillMemberIntoPeriods(group, added);
    backfilledPeriods = result.backfilledCount;
    creditSummary = result.creditSummary;
  }

  // new per-member share for next period (for UI display)
  const nextPeriodStart = getNextPeriodStart(group.billing.cycleDay);
  const nextShares = calculateShares(group, undefined, nextPeriodStart);
  const newShareAmount =
    nextShares.length > 0 ? nextShares[0].amount : group.billing.currentPrice;
  const currency = group.billing.currency;

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "member_added",
    groupId,
    targetMemberId: added._id.toString(),
    metadata: {
      email: added.email,
      nickname: added.nickname,
      backfilledPeriods,
      creditSummaryCount: creditSummary.length,
    },
  });

  return NextResponse.json({
    data: {
      _id: added._id.toString(),
      email: added.email,
      nickname: added.nickname,
      role: added.role,
      isActive: added.isActive,
      backfilledPeriods,
      creditSummary,
      newShareAmount,
      currency,
    },
  });
}
