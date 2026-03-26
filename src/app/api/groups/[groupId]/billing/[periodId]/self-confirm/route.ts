import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";
import { enqueueTask } from "@/lib/tasks/queue";
import { verifyMemberPortalToken } from "@/lib/tokens";
import { db, isStorageId, type StorageGroupMember, type StorageMemberPayment } from "@/lib/storage";

const selfConfirmSchema = z.object({
  memberToken: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string; periodId: string }> }
) {
  const { groupId, periodId } = await context.params;
  if (!isStorageId(groupId) || !isStorageId(periodId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or period id" } },
      { status: 400 }
    );
  }

  const store = await db();

  const parsed = selfConfirmSchema.safeParse(await request.json().catch(() => ({})));
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

  const group = await store.getGroup(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  const session = await auth();
  const memberToken = parsed.data.memberToken;

  let member: StorageGroupMember | undefined;
  let actorId: string;
  let actorName: string;

  if (memberToken) {
    const payload = await verifyMemberPortalToken(memberToken);
    if (!payload || payload.groupId !== groupId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid member link" } },
        { status: 401 }
      );
    }

    member = group.members.find(
      (m: StorageGroupMember) =>
        m.isActive && !m.leftAt && m.id === payload.memberId
    );
    actorId = payload.memberId;
    actorName = member?.nickname || member?.email || "Member";
  } else {
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userEmail = (session.user.email as string) || "";

    member = group.members.find(
      (m: StorageGroupMember) =>
        m.isActive &&
        !m.leftAt &&
        (m.userId === userId || m.email === userEmail)
    );
    actorId = session.user.id;
    actorName =
      (session.user.name as string) ||
      (session.user.email as string) ||
      member?.nickname ||
      "Unknown";
  }

  if (!member) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not a member of this group" } },
      { status: 403 }
    );
  }

  const period = await store.getBillingPeriod(periodId, groupId);
  if (!period) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Billing period not found" } },
      { status: 404 }
    );
  }

  const payIdx = period.payments.findIndex(
    (p: StorageMemberPayment) => p.memberId === member.id
  );
  if (payIdx === -1) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No payment entry for you in this period" } },
      { status: 404 }
    );
  }

  const payment = { ...period.payments[payIdx]! };

  if (payment.status !== "pending" && payment.status !== "overdue") {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "Payment already confirmed or waived",
        },
      },
      { status: 409 }
    );
  }

  payment.status = "member_confirmed";
  payment.memberConfirmedAt = new Date();

  const payments = period.payments.map((p, i) => (i === payIdx ? payment : p));
  await store.updateBillingPeriod(periodId, { payments });

  await enqueueTask({
    type: "admin_confirmation_request",
    runAt: new Date(),
    payload: {
      groupId,
      billingPeriodId: periodId,
    },
  });
  await runNotificationTasks({ limit: 5 });

  await logAudit({
    actorId,
    actorName,
    action: "payment_self_confirmed",
    groupId,
    billingPeriodId: periodId,
    targetMemberId: member.id,
  });

  return NextResponse.json({
    data: {
      memberId: payment.memberId,
      status: payment.status,
      memberConfirmedAt: payment.memberConfirmedAt?.toISOString() ?? null,
    },
  });
}
