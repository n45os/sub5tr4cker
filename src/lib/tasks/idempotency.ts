import type { StorageTaskPayload, StorageTaskType } from "@/lib/storage/types";

/**
 * Build a unique idempotency key for a scheduled task so we don't enqueue
 * duplicate work for the same business event and run window.
 */
export function buildIdempotencyKey(
  type: StorageTaskType,
  payload: StorageTaskPayload,
  runAt: Date
): string {
  const day = runAt.toISOString().slice(0, 10);
  switch (type) {
    case "payment_reminder":
      return `payment_reminder:${payload.billingPeriodId}:${payload.paymentId}:${day}`;
    case "aggregated_payment_reminder":
      return `aggregated_payment_reminder:${payload.memberEmail ?? ""}:${day}`;
    case "admin_confirmation_request":
      return `admin_confirmation_request:${payload.groupId}:${payload.billingPeriodId}:${day}`;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
