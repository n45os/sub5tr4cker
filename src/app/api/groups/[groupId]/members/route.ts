import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
  backfillMemberIntoPeriods,
  recalculateEqualSplitPeriodsForGroup,
} from "@/lib/billing/backfill";
import { calculateShares, getNextPeriodStart } from "@/lib/billing/calculator";
import { db, isStorageId, type StorageGroupMember } from "@/lib/storage";

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
  if (!isStorageId(groupId)) {
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
      { error: { code: "FORBIDDEN", message: "Only the admin can add members" } },
      { status: 403 }
    );
  }

  const { email, nickname, customAmount, billingStartsAt } = parsed.data;
  const existing = group.members.find(
    (m: StorageGroupMember) =>
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

  let billingStartsAtDate: Date | null = null;
  if (billingStartsAt) {
    const d = new Date(billingStartsAt);
    if (!Number.isNaN(d.getTime())) billingStartsAtDate = d;
  }

  const newMember: StorageGroupMember = {
    id: nanoid(),
    userId: null,
    email,
    nickname,
    customAmount: customAmount ?? null,
    role: "member",
    isActive: true,
    leftAt: null,
    joinedAt: new Date(),
    acceptedAt: null,
    unsubscribedFromEmail: false,
    billingStartsAt: billingStartsAtDate,
  };

  await store.updateGroup(groupId, { members: [...group.members, newMember] });

  const memberBillingStart = newMember.billingStartsAt ?? newMember.joinedAt;

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

  const groupAfterAdd = (await store.getGroup(groupId))!;

  if (
    memberBillingStart &&
    !Number.isNaN(memberBillingStart.getTime()) &&
    memberBillingStart.getTime() <= Date.now()
  ) {
    const result = await backfillMemberIntoPeriods(groupAfterAdd, newMember);
    backfilledPeriods = result.backfilledCount;
    creditSummary = result.creditSummary;
  }

  // resync all periods: drop orphan rows and align shares after roster change
  let periodsReconciled = 0;
  if (
    groupAfterAdd.billing.mode === "equal_split" ||
    groupAfterAdd.billing.mode === "variable"
  ) {
    const fresh = await store.getGroup(groupId);
    if (fresh) {
      const reconciled = await recalculateEqualSplitPeriodsForGroup(fresh);
      periodsReconciled = reconciled.periodsUpdated;
    }
  }

  // new per-member share for next period (for UI display)
  const nextPeriodStart = getNextPeriodStart(groupAfterAdd.billing.cycleDay);
  const nextShares = calculateShares(groupAfterAdd, undefined, nextPeriodStart);
  const newShareAmount =
    nextShares.length > 0 ? nextShares[0].amount : groupAfterAdd.billing.currentPrice;
  const currency = groupAfterAdd.billing.currency;

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "member_added",
    groupId,
    targetMemberId: newMember.id,
    metadata: {
      email: newMember.email,
      nickname: newMember.nickname,
      backfilledPeriods,
      creditSummaryCount: creditSummary.length,
      periodsReconciled,
    },
  });

  return NextResponse.json({
    data: {
      _id: newMember.id,
      email: newMember.email,
      nickname: newMember.nickname,
      role: newMember.role,
      isActive: newMember.isActive,
      backfilledPeriods,
      creditSummary,
      periodsReconciled,
      newShareAmount,
      currency,
    },
  });
}
