import { db, type StorageMemberPayment, type StorageScheduledTask } from "@/lib/storage";
import { sendReminderForPayment } from "@/lib/notifications/reminder-send";
import {
  sendAggregatedReminder,
  type AggregatedReminderRecipient,
  type AggregatedPaymentInput,
} from "@/lib/notifications/aggregated-reminder-send";
import { sendAdminConfirmationNudge } from "@/lib/notifications/admin-nudge";
import { completeTask, failTask } from "./queue";

function isPaymentStillUnpaid(payment: StorageMemberPayment): boolean {
  return payment.status === "pending" || payment.status === "overdue";
}

/**
 * Execute a single scheduled task (load data, send notification, update task state).
 */
export async function executeTask(task: StorageScheduledTask): Promise<void> {
  const payload = task.payload as {
    groupId?: string;
    billingPeriodId?: string;
    memberId?: string;
    memberUserId?: string | null;
    paymentId?: string;
    memberEmail?: string | null;
    recipientKey?: string;
    recipientLabel?: string;
    payments?: Array<{
      groupId: string;
      billingPeriodId: string;
      memberId: string;
      paymentId: string;
    }>;
  };

  try {
    const store = await db();
    switch (task.type) {
      case "payment_reminder": {
        if (!payload.billingPeriodId || !payload.paymentId) {
          throw new Error("payment_reminder task missing billingPeriodId or paymentId");
        }
        const group = payload.groupId ? await store.getGroup(payload.groupId) : null;
        const period = payload.groupId
          ? await store.getBillingPeriod(payload.billingPeriodId, payload.groupId)
          : null;
        if (!group || !period) {
          throw new Error("group or period not found");
        }
        const payment = period.payments.find(
          (p) => p.id === payload.paymentId
        );
        if (!payment) {
          throw new Error("payment not found");
        }
        if (!isPaymentStillUnpaid(payment)) {
          await completeTask(task);
          return;
        }
        await sendReminderForPayment(group, period, payment);
        break;
      }
      case "aggregated_payment_reminder": {
        if (!payload.memberId || !payload.payments?.length) {
          throw new Error(
            "aggregated_payment_reminder task missing recipient or payments"
          );
        }
        const inputs: AggregatedPaymentInput[] = [];
        for (const ref of payload.payments) {
          const group = await store.getGroup(ref.groupId);
          const period = await store.getBillingPeriod(ref.billingPeriodId, ref.groupId);
          if (!group || !period) continue;
          const payment = period.payments.find(
            (p) => p.id === ref.paymentId
          );
          if (!payment) continue;
          if (!isPaymentStillUnpaid(payment)) continue;
          inputs.push({
            group,
            period,
            payment,
          });
        }
        if (inputs.length === 0) {
          await completeTask(task);
          return;
        }
        const recipient: AggregatedReminderRecipient = {
          memberId: payload.memberId,
          memberUserId: payload.memberUserId ?? null,
          memberEmail: payload.memberEmail ?? null,
          recipientLabel: payload.recipientLabel,
          memberName: inputs[0].payment.memberNickname,
        };
        await sendAggregatedReminder(recipient, inputs);
        break;
      }
      case "admin_confirmation_request": {
        if (!payload.billingPeriodId) {
          throw new Error("admin_confirmation_request task missing billingPeriodId");
        }
        const group = payload.groupId ? await store.getGroup(payload.groupId) : null;
        const period = payload.groupId
          ? await store.getBillingPeriod(payload.billingPeriodId, payload.groupId)
          : null;
        if (!group || !period) {
          throw new Error("group or period not found");
        }
        await sendAdminConfirmationNudge(group, period);
        break;
      }
      default:
        throw new Error(`unsupported task type: ${task.type}`);
    }

    await completeTask(task);
  } catch (error) {
    await failTask(task, error);
    throw error;
  }
}

/**
 * Claim a batch of due tasks, execute each, and return counts.
 */
export async function runWorkerBatch(
  workerId: string,
  options: { limit?: number; lockTtlMs?: number; recoverStaleLocks?: boolean } = {}
): Promise<{ claimed: number; completed: number; failed: number }> {
  const { claimTasks } = await import("./queue");
  const tasks = await claimTasks(workerId, {
    ...options,
    recoverStaleLocks: options.recoverStaleLocks ?? true,
  });

  let completed = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      await executeTask(task);
      completed++;
    } catch {
      failed++;
    }
  }

  return { claimed: tasks.length, completed, failed };
}
