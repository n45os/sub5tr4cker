import { logAudit } from "@/lib/audit";
import {
  db,
  type StorageBillingPeriod,
  type StorageMemberPayment,
} from "@/lib/storage";

export type AdminPaymentDecisionAction = "confirm" | "reject" | "waive";

export type AdminPaymentDecisionResult =
  | {
      ok: true;
      period: StorageBillingPeriod;
      payment: StorageMemberPayment;
    }
  | {
      ok: false;
      code:
        | "GROUP_NOT_FOUND"
        | "FORBIDDEN"
        | "PERIOD_NOT_FOUND"
        | "PAYMENT_NOT_FOUND";
    };

export interface ApplyAdminPaymentDecisionParams {
  groupId: string;
  periodId: string;
  memberId: string;
  action: AdminPaymentDecisionAction;
  actor: { id: string; name: string };
  notes?: string;
}

// shared helper used by the dashboard route and the telegram callback path so
// both flows update the payment, recompute isFullyPaid, and emit the same
// audit entry in lockstep.
export async function applyAdminPaymentDecision(
  params: ApplyAdminPaymentDecisionParams
): Promise<AdminPaymentDecisionResult> {
  const { groupId, periodId, memberId, action, actor, notes } = params;

  const store = await db();
  const group = await store.getGroup(groupId);
  if (!group || !group.isActive) {
    return { ok: false, code: "GROUP_NOT_FOUND" };
  }
  if (group.adminId !== actor.id) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const period = await store.getBillingPeriod(periodId, groupId);
  if (!period) {
    return { ok: false, code: "PERIOD_NOT_FOUND" };
  }

  const payIdx = period.payments.findIndex((p) => p.memberId === memberId);
  if (payIdx === -1) {
    return { ok: false, code: "PAYMENT_NOT_FOUND" };
  }

  const payment = { ...period.payments[payIdx]! };
  if (action === "confirm") {
    payment.status = "confirmed";
    payment.adminConfirmedAt = new Date();
  } else if (action === "waive") {
    payment.status = "waived";
    payment.adminConfirmedAt = new Date();
  } else {
    payment.status = "pending";
    payment.adminConfirmedAt = null;
    payment.memberConfirmedAt = null;
  }
  if (notes !== undefined) payment.notes = notes;

  const payments = period.payments.map((p, i) => (i === payIdx ? payment : p));
  const isFullyPaid = payments.every(
    (p) => p.status === "confirmed" || p.status === "waived"
  );

  const updated = await store.updateBillingPeriod(periodId, {
    payments,
    isFullyPaid,
  });

  const auditAction =
    action === "confirm"
      ? "payment_confirmed"
      : action === "waive"
        ? "payment_waived"
        : "payment_rejected";
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: auditAction,
    groupId,
    billingPeriodId: periodId,
    targetMemberId: memberId,
    metadata: { notes },
  });

  const updatedPayment =
    updated.payments.find((p) => p.memberId === memberId) ?? payment;
  return { ok: true, period: updated, payment: updatedPayment };
}

export type ConfirmAllResult =
  | {
      ok: true;
      period: StorageBillingPeriod;
      confirmedMemberIds: string[];
    }
  | {
      ok: false;
      code: "GROUP_NOT_FOUND" | "FORBIDDEN" | "PERIOD_NOT_FOUND";
    };

export interface ConfirmAllMemberConfirmedParams {
  groupId: string;
  periodId: string;
  actor: { id: string; name: string };
}

// bulk-confirm every payment whose status is `member_confirmed` in one period.
// updates the period once, then logs one audit entry per confirmed payment.
export async function confirmAllMemberConfirmed(
  params: ConfirmAllMemberConfirmedParams
): Promise<ConfirmAllResult> {
  const { groupId, periodId, actor } = params;

  const store = await db();
  const group = await store.getGroup(groupId);
  if (!group || !group.isActive) {
    return { ok: false, code: "GROUP_NOT_FOUND" };
  }
  if (group.adminId !== actor.id) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const period = await store.getBillingPeriod(periodId, groupId);
  if (!period) {
    return { ok: false, code: "PERIOD_NOT_FOUND" };
  }

  const now = new Date();
  const confirmedMemberIds: string[] = [];
  const payments = period.payments.map((p) => {
    if (p.status !== "member_confirmed") return p;
    confirmedMemberIds.push(p.memberId);
    return { ...p, status: "confirmed" as const, adminConfirmedAt: now };
  });

  if (confirmedMemberIds.length === 0) {
    return { ok: true, period, confirmedMemberIds: [] };
  }

  const isFullyPaid = payments.every(
    (p) => p.status === "confirmed" || p.status === "waived"
  );

  const updated = await store.updateBillingPeriod(periodId, {
    payments,
    isFullyPaid,
  });

  for (const memberId of confirmedMemberIds) {
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      action: "payment_confirmed",
      groupId,
      billingPeriodId: periodId,
      targetMemberId: memberId,
    });
  }

  return { ok: true, period: updated, confirmedMemberIds };
}
