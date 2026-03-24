import mongoose, { Schema, Document } from "mongoose";

export type ScheduledTaskType =
  | "payment_reminder"
  | "aggregated_payment_reminder"
  | "admin_confirmation_request";

export type ScheduledTaskStatus =
  | "pending"
  | "locked"
  | "completed"
  | "failed"
  | "cancelled";

export interface IScheduledTaskPayload {
  groupId?: string;
  billingPeriodId?: string;
  memberId?: string;
  paymentId?: string;
  /** optional: restrict to one channel; if absent, worker sends to all eligible channels */
  channel?: "email" | "telegram";
  /** for aggregated_payment_reminder: user email and list of payments to include */
  memberEmail?: string;
  payments?: Array<{
    groupId: string;
    billingPeriodId: string;
    memberId: string;
    paymentId: string;
  }>;
  [key: string]: unknown;
}

export interface IScheduledTask extends Document {
  type: ScheduledTaskType;
  status: ScheduledTaskStatus;
  runAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  completedAt: Date | null;
  idempotencyKey: string;
  payload: IScheduledTaskPayload;
  /** set when status is cancelled (admin or bulk cancel) */
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledTaskSchema = new Schema<IScheduledTask>(
  {
    type: {
      type: String,
      enum: [
        "payment_reminder",
        "aggregated_payment_reminder",
        "admin_confirmation_request",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "locked", "completed", "failed", "cancelled"],
      default: "pending",
    },
    runAt: { type: Date, required: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastError: { type: String, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

// claim due tasks by status; lock expiry for stuck workers
scheduledTaskSchema.index({ status: 1, runAt: 1 });
scheduledTaskSchema.index({ lockedAt: 1 }, { sparse: true });
// idempotency: one task per business event per type
scheduledTaskSchema.index({ idempotencyKey: 1 }, { unique: true });
scheduledTaskSchema.index({ type: 1, "payload.groupId": 1 });
scheduledTaskSchema.index({ createdAt: 1 });

export const ScheduledTask =
  mongoose.models.ScheduledTask ||
  mongoose.model<IScheduledTask>("ScheduledTask", scheduledTaskSchema);
