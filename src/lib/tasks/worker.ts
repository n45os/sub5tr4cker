import { Types } from "mongoose";
import type { IScheduledTask } from "@/models/scheduled-task";
import type { IMemberPayment } from "@/models/billing-period";
import { Group, BillingPeriod } from "@/models";
import { sendReminderForPayment } from "@/lib/notifications/reminder-send";
import {
  sendAggregatedReminder,
  type AggregatedPaymentInput,
} from "@/lib/notifications/aggregated-reminder-send";
import { sendAdminConfirmationNudge } from "@/lib/notifications/admin-nudge";
import { completeTask, failTask } from "./queue";

/**
 * Execute a single scheduled task (load data, send notification, update task state).
 */
export async function executeTask(task: IScheduledTask): Promise<void> {
  const payload = task.payload as {
    groupId?: string;
    billingPeriodId?: string;
    memberId?: string;
    paymentId?: string;
    memberEmail?: string;
    payments?: Array<{
      groupId: string;
      billingPeriodId: string;
      memberId: string;
      paymentId: string;
    }>;
  };

  try {
    switch (task.type) {
      case "payment_reminder": {
        if (!payload.billingPeriodId || !payload.paymentId) {
          throw new Error("payment_reminder task missing billingPeriodId or paymentId");
        }
        const group = await Group.findById(payload.groupId);
        const period = await BillingPeriod.findById(payload.billingPeriodId).populate(
          "group"
        );
        if (!group || !period) {
          throw new Error("group or period not found");
        }
        const payment = period.payments.find(
          (p: IMemberPayment) => (p._id as Types.ObjectId).toString() === payload.paymentId
        );
        if (!payment) {
          throw new Error("payment not found");
        }
        await sendReminderForPayment(group, period, payment);
        break;
      }
      case "aggregated_payment_reminder": {
        if (!payload.memberEmail || !payload.payments?.length) {
          throw new Error(
            "aggregated_payment_reminder task missing memberEmail or payments"
          );
        }
        const inputs: AggregatedPaymentInput[] = [];
        for (const ref of payload.payments) {
          const group = await Group.findById(ref.groupId);
          const period = await BillingPeriod.findById(ref.billingPeriodId).populate(
            "group"
          );
          if (!group || !period) continue;
          const payment = period.payments.find(
            (p: IMemberPayment) =>
              (p._id as Types.ObjectId).toString() === ref.paymentId
          );
          if (!payment) continue;
          inputs.push({
            group: group as AggregatedPaymentInput["group"],
            period: period as AggregatedPaymentInput["period"],
            payment,
          });
        }
        if (inputs.length === 0) {
          throw new Error("aggregated_payment_reminder: no valid payments found");
        }
        const memberName = inputs[0].payment.memberNickname;
        await sendAggregatedReminder(
          payload.memberEmail,
          memberName,
          inputs
        );
        break;
      }
      case "admin_confirmation_request": {
        if (!payload.billingPeriodId) {
          throw new Error("admin_confirmation_request task missing billingPeriodId");
        }
        const group = await Group.findById(payload.groupId);
        const period = await BillingPeriod.findById(payload.billingPeriodId);
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
