import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationType =
  | "payment_reminder"
  | "payment_confirmed"
  | "admin_confirmation_request"
  | "price_change"
  | "price_adjustment"
  | "announcement"
  | "invite"
  | "follow_up"
  | "member_message";

export interface INotification extends Document {
  recipient: Types.ObjectId | null;
  recipientEmail: string;
  group: Types.ObjectId | null;
  billingPeriod: Types.ObjectId | null;
  type: NotificationType;
  channel: "email" | "telegram";
  status: "sent" | "failed" | "pending";
  subject: string | null;
  preview: string;
  externalId: string | null;
  error: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recipientEmail: { type: String, required: true },
    group: { type: Schema.Types.ObjectId, ref: "Group", default: null },
    billingPeriod: {
      type: Schema.Types.ObjectId,
      ref: "BillingPeriod",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "payment_reminder",
        "payment_confirmed",
        "admin_confirmation_request",
        "price_change",
        "price_adjustment",
        "announcement",
        "invite",
        "follow_up",
        "member_message",
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ["email", "telegram"],
      required: true,
    },
    status: {
      type: String,
      enum: ["sent", "failed", "pending"],
      default: "pending",
    },
    subject: { type: String, default: null },
    preview: { type: String, required: true },
    externalId: { type: String, default: null },
    error: { type: String, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1 });
notificationSchema.index({ group: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: 1 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", notificationSchema);
