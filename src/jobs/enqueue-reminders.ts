import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group } from "@/models";
import {
  collectionWindowOpenFilter,
  getFirstReminderEligibleAt,
  resolveCollectionOpensAt,
} from "@/lib/billing/collection-window";
import { getSetting } from "@/lib/settings/service";
import { normalizeMemberEmailForAggregation } from "@/lib/notifications/member-email";
import { enqueueTask } from "@/lib/tasks/queue";

type PaymentRef = {
  groupId: string;
  billingPeriodId: string;
  memberId: string;
  paymentId: string;
  memberEmail: string;
};

/**
 * Scan for unpaid billing periods whose collection window is open and past
 * grace-from-open, then enqueue one payment_reminder task per eligible payment
 * (or one aggregated_payment_reminder per unique member email when aggregation is
 * enabled). Idempotency key includes period, payment, and run date so we only
 * enqueue once per payment per day.
 */
export async function enqueueReminders(): Promise<number> {
  await dbConnect();

  const now = new Date();
  const aggregateReminders =
    (await getSetting("notifications.aggregateReminders")) === "true";
  let enqueued = 0;

  const periods = await BillingPeriod.find({
    isFullyPaid: false,
    ...collectionWindowOpenFilter(now),
    "payments.status": { $in: ["pending", "overdue"] },
  }).populate("group");

  if (aggregateReminders) {
    const byEmail = new Map<string, PaymentRef[]>();
    for (const period of periods) {
      const group = period.group as InstanceType<typeof Group> | null;
      if (!group || typeof group !== "object" || Array.isArray(group)) continue;
      if (!group.isActive) continue;
      if (group.notifications?.remindersEnabled === false) continue;

      const graceDays = group.billing.gracePeriodDays ?? 3;
      const collectionOpensAt = resolveCollectionOpensAt(period);
      const firstReminderAt = getFirstReminderEligibleAt(
        collectionOpensAt,
        graceDays
      );
      if (now < firstReminderAt) continue;

      const groupId = (group._id as { toString: () => string }).toString();
      const billingPeriodId = (period._id as { toString: () => string }).toString();

      for (const payment of period.payments) {
        if (payment.status !== "pending" && payment.status !== "overdue") continue;
        const bucketKey = normalizeMemberEmailForAggregation(payment.memberEmail);
        const ref: PaymentRef = {
          groupId,
          billingPeriodId,
          memberId: (payment.memberId as { toString: () => string }).toString(),
          paymentId: (payment._id as { toString: () => string }).toString(),
          memberEmail: payment.memberEmail,
        };
        const list = byEmail.get(bucketKey) ?? [];
        list.push(ref);
        byEmail.set(bucketKey, list);
      }
    }
    for (const [, refs] of byEmail) {
      if (refs.length === 0) continue;
      const memberEmail = refs[0].memberEmail;
      const payments = refs.map((r) => ({
        groupId: r.groupId,
        billingPeriodId: r.billingPeriodId,
        memberId: r.memberId,
        paymentId: r.paymentId,
      }));
      const task = await enqueueTask({
        type: "aggregated_payment_reminder",
        runAt: now,
        payload: { memberEmail, payments },
      });
      if (task) enqueued++;
    }
    return enqueued;
  }

  for (const period of periods) {
    const group = await Group.findById(period.group);
    if (!group || !group.isActive) continue;
    if (group.notifications?.remindersEnabled === false) continue;

    const graceDays = group.billing.gracePeriodDays ?? 3;
    const collectionOpensAt = resolveCollectionOpensAt(period);
    const firstReminderAt = getFirstReminderEligibleAt(
      collectionOpensAt,
      graceDays
    );
    if (now < firstReminderAt) continue;

    const groupId = (group._id as { toString: () => string }).toString();
    const billingPeriodId = (period._id as { toString: () => string }).toString();

    for (const payment of period.payments) {
      if (payment.status !== "pending" && payment.status !== "overdue") {
        continue;
      }

      const paymentId = (payment._id as { toString: () => string }).toString();
      const task = await enqueueTask({
        type: "payment_reminder",
        runAt: now,
        payload: {
          groupId,
          billingPeriodId,
          memberId: (payment.memberId as { toString: () => string }).toString(),
          paymentId,
        },
      });
      if (task) enqueued++;
    }
  }

  return enqueued;
}
