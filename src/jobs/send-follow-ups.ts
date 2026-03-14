import { reconcileOverduePayments } from "./reconcile-overdue";
import { enqueueAdminFollowUps } from "./enqueue-follow-ups";

/**
 * Follow-up job: reconcile overdue payment state and enqueue admin
 * confirmation nudges for periods with member_confirmed payments.
 * Actual sends are done by the notification task worker.
 */
export async function sendFollowUps(): Promise<{
  overdueReconciled: number;
  adminNudgesEnqueued: number;
}> {
  const overdueReconciled = await reconcileOverduePayments();
  const adminNudgesEnqueued = await enqueueAdminFollowUps();
  return { overdueReconciled, adminNudgesEnqueued };
}
