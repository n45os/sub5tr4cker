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
  // reminders honor the recipient's reminderFrequency by widening the day
  // bucket (see enqueue-reminders); other task types stay day-scoped
  const bucket = payload.frequencyBucket || day;
  switch (type) {
    case "payment_reminder":
      return `payment_reminder:${payload.billingPeriodId}:${payload.paymentId}:${bucket}`;
    case "aggregated_payment_reminder":
      return `aggregated_payment_reminder:${payload.recipientKey ?? payload.memberEmail ?? payload.memberId ?? ""}:${bucket}`;
    case "admin_confirmation_request":
      // memberId scopes per-confirmation nudges so a second member confirming
      // the same period on the same day still notifies the admin; periodic
      // follow-ups omit it and stay day-scoped
      return `admin_confirmation_request:${payload.groupId}:${payload.billingPeriodId}:${payload.memberId ?? "period"}:${day}`;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
