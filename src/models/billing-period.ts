import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMemberPayment {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  memberEmail: string;
  memberNickname: string;
  amount: number;
  /** admin override of the calculated share for this specific period+member */
  adjustedAmount: number | null;
  /** free-text explanation for the adjustment */
  adjustmentReason: string | null;
  status: "pending" | "member_confirmed" | "confirmed" | "overdue" | "waived";
  memberConfirmedAt: Date | null;
  adminConfirmedAt: Date | null;
  confirmationToken: string | null;
  notes: string | null;
}

export interface IReminderEntry {
  sentAt: Date;
  channel: "email" | "telegram";
  recipientCount: number;
  type: "initial" | "follow_up";
}

export interface IBillingPeriod extends Document {
  group: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  totalPrice: number;
  currency: string;
  /** blanket admin note for the whole period (e.g. "annual price hike") */
  priceNote: string | null;
  payments: IMemberPayment[];
  reminders: IReminderEntry[];
  isFullyPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const memberPaymentSchema = new Schema<IMemberPayment>({
  memberId: { type: Schema.Types.ObjectId, required: true },
  memberEmail: { type: String, required: true },
  memberNickname: { type: String, required: true },
  amount: { type: Number, required: true },
  adjustedAmount: { type: Number, default: null },
  adjustmentReason: { type: String, default: null },
  status: {
    type: String,
    enum: ["pending", "member_confirmed", "confirmed", "overdue", "waived"],
    default: "pending",
  },
  memberConfirmedAt: { type: Date, default: null },
  adminConfirmedAt: { type: Date, default: null },
  confirmationToken: { type: String, default: null },
  notes: { type: String, default: null },
});

const reminderEntrySchema = new Schema<IReminderEntry>({
  sentAt: { type: Date, default: Date.now },
  channel: { type: String, enum: ["email", "telegram"], required: true },
  recipientCount: { type: Number, required: true },
  type: { type: String, enum: ["initial", "follow_up"], default: "initial" },
});

const billingPeriodSchema = new Schema<IBillingPeriod>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    periodLabel: { type: String, required: true },
    totalPrice: { type: Number, required: true },
    currency: { type: String, default: "EUR" },
    priceNote: { type: String, default: null },
    payments: [memberPaymentSchema],
    reminders: [reminderEntrySchema],
    isFullyPaid: { type: Boolean, default: false },
  },
  { timestamps: true }
);

billingPeriodSchema.index({ group: 1, periodStart: 1 }, { unique: true });
billingPeriodSchema.index({ "payments.status": 1 });
billingPeriodSchema.index(
  { "payments.confirmationToken": 1 },
  { sparse: true }
);

export const BillingPeriod =
  mongoose.models.BillingPeriod ||
  mongoose.model<IBillingPeriod>("BillingPeriod", billingPeriodSchema);
