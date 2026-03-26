import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { db, isStorageId, type StorageMemberPayment } from "@/lib/storage";

const confirmSchema = z.object({
  memberId: z.string(),
  action: z.enum(["confirm", "reject", "waive"]),
  notes: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string; periodId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId, periodId } = await context.params;
  if (!isStorageId(groupId) || !isStorageId(periodId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or period id" } },
      { status: 400 }
    );
  }

  const parsed = confirmSchema.safeParse(await request.json());
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
      { error: { code: "FORBIDDEN", message: "Only the admin can confirm payments" } },
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
    (p: StorageMemberPayment) => p.memberId === parsed.data.memberId
  );
  if (payIdx === -1) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Payment entry not found" } },
      { status: 404 }
    );
  }

  const payment = { ...period.payments[payIdx]! };

  if (parsed.data.action === "confirm") {
    payment.status = "confirmed";
    payment.adminConfirmedAt = new Date();
  } else if (parsed.data.action === "waive") {
    payment.status = "waived";
    payment.adminConfirmedAt = new Date();
  } else {
    payment.status = "pending";
    payment.adminConfirmedAt = null;
    payment.memberConfirmedAt = null;
  }
  if (parsed.data.notes !== undefined) payment.notes = parsed.data.notes;

  const payments = period.payments.map((p, i) => (i === payIdx ? payment : p));
  const isFullyPaid = payments.every(
    (p: StorageMemberPayment) => p.status === "confirmed" || p.status === "waived"
  );

  await store.updateBillingPeriod(periodId, { payments, isFullyPaid });

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  const auditAction =
    parsed.data.action === "confirm"
      ? "payment_confirmed"
      : parsed.data.action === "waive"
        ? "payment_waived"
        : "payment_rejected";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: auditAction,
    groupId,
    billingPeriodId: periodId,
    targetMemberId: parsed.data.memberId,
    metadata: { notes: parsed.data.notes },
  });

  return NextResponse.json({
    data: {
      memberId: payment.memberId,
      status: payment.status,
      adminConfirmedAt: payment.adminConfirmedAt?.toISOString() ?? null,
    },
  });
}
