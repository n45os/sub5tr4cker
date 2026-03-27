import {
  getFirstReminderEligibleAt,
  resolveCollectionOpensAt,
} from "@/lib/billing/collection-window";
import { getSetting } from "@/lib/settings/service";
import {
  getRecipientKey,
  getRecipientLabel,
} from "@/lib/notifications/member-email";
import { enqueueTask } from "@/lib/tasks/queue";
import { db, type StorageMemberPayment } from "@/lib/storage";

type PaymentRef = {
  groupId: string;
  billingPeriodId: string;
  memberId: string;
  memberUserId: string | null;
  paymentId: string;
  memberEmail: string | null;
  recipientKey: string;
  recipientLabel: string;
  memberNickname: string;
};

/**
 * Scan for unpaid billing periods whose collection window is open and past
 * grace-from-open, then enqueue one payment_reminder task per eligible payment
 * (or one aggregated_payment_reminder per unique member email when aggregation is
 * enabled). Idempotency key includes period, payment, and run date so we only
 * enqueue once per payment per day.
 */
export async function enqueueReminders(): Promise<number> {
  const store = await db();
  const now = new Date();
  const aggregateReminders =
    (await getSetting("notifications.aggregateReminders")) === "true";
  let enqueued = 0;

  const periodsRaw = await store.getOpenBillingPeriods({
    asOf: now,
    unpaidOnly: true,
  });

  const periods = periodsRaw.filter((period) =>
    period.payments.some(
      (p: StorageMemberPayment) => p.status === "pending" || p.status === "overdue"
    )
  );

  if (aggregateReminders) {
    const byRecipient = new Map<string, PaymentRef[]>();
    for (const period of periods) {
      const group = await store.getGroup(period.groupId);
      if (!group || !group.isActive) continue;
      if (group.notifications?.remindersEnabled === false) continue;

      const graceDays = group.billing.gracePeriodDays ?? 3;
      const collectionOpensAt = resolveCollectionOpensAt(period);
      const firstReminderAt = getFirstReminderEligibleAt(collectionOpensAt, graceDays);
      if (now < firstReminderAt) continue;

      const groupId = group.id;
      const billingPeriodId = period.id;

      for (const payment of period.payments) {
        if (payment.status !== "pending" && payment.status !== "overdue") continue;
        const member = group.members.find((entry) => entry.id === payment.memberId);
        const recipientKey = getRecipientKey({
          memberId: payment.memberId,
          memberEmail: payment.memberEmail,
          memberNickname: payment.memberNickname,
          memberUserId: member?.userId ?? null,
        });
        const ref: PaymentRef = {
          groupId,
          billingPeriodId,
          memberId: payment.memberId,
          memberUserId: member?.userId ?? null,
          paymentId: payment.id,
          memberEmail: payment.memberEmail,
          recipientKey,
          recipientLabel: getRecipientLabel({
            memberId: payment.memberId,
            memberEmail: payment.memberEmail,
            memberNickname: payment.memberNickname,
            memberUserId: member?.userId ?? null,
          }),
          memberNickname: payment.memberNickname,
        };
        const list = byRecipient.get(recipientKey) ?? [];
        list.push(ref);
        byRecipient.set(recipientKey, list);
      }
    }
    for (const [, refs] of byRecipient) {
      if (refs.length === 0) continue;
      const firstRef = refs[0];
      const payments = refs.map((r) => ({
        groupId: r.groupId,
        billingPeriodId: r.billingPeriodId,
        memberId: r.memberId,
        paymentId: r.paymentId,
      }));
      const task = await enqueueTask({
        type: "aggregated_payment_reminder",
        runAt: now,
        payload: {
          memberId: firstRef.memberId,
          memberUserId: firstRef.memberUserId,
          memberEmail: firstRef.memberEmail,
          recipientKey: firstRef.recipientKey,
          recipientLabel: firstRef.recipientLabel,
          payments,
        },
      });
      if (task) enqueued++;
    }
    return enqueued;
  }

  for (const period of periods) {
    const group = await store.getGroup(period.groupId);
    if (!group || !group.isActive) continue;
    if (group.notifications?.remindersEnabled === false) continue;

    const graceDays = group.billing.gracePeriodDays ?? 3;
    const collectionOpensAt = resolveCollectionOpensAt(period);
    const firstReminderAt = getFirstReminderEligibleAt(collectionOpensAt, graceDays);
    if (now < firstReminderAt) continue;

    const groupId = group.id;
    const billingPeriodId = period.id;

    for (const payment of period.payments) {
      if (payment.status !== "pending" && payment.status !== "overdue") {
        continue;
      }

      const task = await enqueueTask({
        type: "payment_reminder",
        runAt: now,
        payload: {
          groupId,
          billingPeriodId,
          memberId: payment.memberId,
          paymentId: payment.id,
        },
      });
      if (task) enqueued++;
    }
  }

  return enqueued;
}
