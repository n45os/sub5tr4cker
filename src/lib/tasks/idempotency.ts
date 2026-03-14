import type { ScheduledTaskType } from "@/models/scheduled-task";
import type { IScheduledTaskPayload } from "@/models/scheduled-task";

/**
 * Build a unique idempotency key for a scheduled task so we don't enqueue
 * duplicate work for the same business event and run window.
 */
export function buildIdempotencyKey(
  type: ScheduledTaskType,
  payload: IScheduledTaskPayload,
  runAt: Date
): string {
  const day = runAt.toISOString().slice(0, 10);
  switch (type) {
    case "payment_reminder":
      return `payment_reminder:${payload.billingPeriodId}:${payload.paymentId}:${day}`;
    case "admin_confirmation_request":
      return `admin_confirmation_request:${payload.groupId}:${payload.billingPeriodId}:${day}`;
    default:
      return `${type}:${payload.groupId}:${payload.billingPeriodId ?? ""}:${payload.memberId ?? ""}:${day}`;
  }
}
