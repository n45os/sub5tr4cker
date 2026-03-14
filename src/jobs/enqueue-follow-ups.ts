import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group } from "@/models";
import { enqueueTask } from "@/lib/tasks/queue";

/**
 * Scan for billing periods with member_confirmed payments and enqueue
 * one admin_confirmation_request task per period per run date.
 */
export async function enqueueAdminFollowUps(): Promise<number> {
  await dbConnect();

  const now = new Date();
  let enqueued = 0;

  const periods = await BillingPeriod.find({
    isFullyPaid: false,
    periodStart: { $lt: now },
  });

  for (const period of periods) {
    const hasUnverified = period.payments.some(
      (p: { status: string }) => p.status === "member_confirmed"
    );
    if (!hasUnverified) continue;

    const group = await Group.findById(period.group);
    if (!group || !group.isActive) continue;
    if (group.notifications?.followUpsEnabled === false) continue;

    const groupId = (group._id as { toString: () => string }).toString();
    const billingPeriodId = (period._id as { toString: () => string }).toString();

    const task = await enqueueTask({
      type: "admin_confirmation_request",
      runAt: now,
      payload: { groupId, billingPeriodId },
    });
    if (task) enqueued++;
  }

  return enqueued;
}
