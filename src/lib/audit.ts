import { db, type StorageAuditAction } from "@/lib/storage";

interface LogAuditParams {
  actorId: string;
  actorName: string;
  action: StorageAuditAction;
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
    const store = await db();
    await store.logAudit({
      actorId,
      actorName,
      action,
      groupId: groupId || undefined,
      billingPeriodId: billingPeriodId || undefined,
      targetMemberId: targetMemberId || undefined,
      metadata,
    });
  } catch (err) {
    console.error("[audit] failed to log event:", err);
  }
}
