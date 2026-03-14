import { AuditEvent } from "@/models";
import type { AuditAction } from "@/models";

interface LogAuditParams {
  actorId: string;
  actorName: string;
  action: AuditAction;
  groupId?: string | null;
  billingPeriodId?: string | null;
  targetMemberId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  const {
    actorId,
    actorName,
    action,
    groupId = null,
    billingPeriodId = null,
    targetMemberId = null,
    metadata = {},
  } = params;
  try {
    await AuditEvent.create({
      actor: actorId,
      actorName,
      action,
      group: groupId || undefined,
      billingPeriod: billingPeriodId || undefined,
      targetMember: targetMemberId || undefined,
      metadata,
    });
  } catch (err) {
    console.error("[audit] failed to log event:", err);
  }
}
