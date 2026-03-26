import { enqueueTask } from "@/lib/tasks/queue";
import { db } from "@/lib/storage";

/**
 * Scan for billing periods with member_confirmed payments and enqueue
 * one admin_confirmation_request task per period per run date.
 */
export async function enqueueAdminFollowUps(): Promise<number> {
  const store = await db();
  const now = new Date();
  let enqueued = 0;

  const periods = await store.getOpenBillingPeriods({
    asOf: now,
    unpaidOnly: true,
  });

  for (const period of periods) {
    const hasUnverified = period.payments.some((p) => p.status === "member_confirmed");
    if (!hasUnverified) continue;

    const group = await store.getGroup(period.groupId);
    if (!group || !group.isActive) continue;
    if (group.notifications?.followUpsEnabled === false) continue;

    const groupId = group.id;
    const billingPeriodId = period.id;

    const task = await enqueueTask({
      type: "admin_confirmation_request",
      runAt: now,
      payload: { groupId, billingPeriodId },
    });
    if (task) enqueued++;
  }

  return enqueued;
}
