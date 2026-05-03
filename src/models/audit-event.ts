import mongoose, { Schema, Document, Types } from "mongoose";

export type AuditAction =
  | "payment_confirmed"
  | "payment_self_confirmed"
  | "payment_rejected"
  | "payment_waived"
  | "group_created"
  | "group_edited"
  | "member_added"
  | "member_removed"
  | "member_updated"
  | "billing_period_created"
  | "period_dedup_hit";

export interface IAuditEvent extends Document {
  actor: Types.ObjectId;
  actorName: string;
  action: AuditAction;
  group: Types.ObjectId | null;
  billingPeriod: Types.ObjectId | null;
  targetMember: Types.ObjectId | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditEventSchema = new Schema<IAuditEvent>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true },
    action: {
      type: String,
      enum: [
        "payment_confirmed",
        "payment_self_confirmed",
        "payment_rejected",
        "payment_waived",
        "group_created",
        "group_edited",
        "member_added",
        "member_removed",
        "member_updated",
        "billing_period_created",
        "period_dedup_hit",
      ],
      required: true,
    },
    group: { type: Schema.Types.ObjectId, ref: "Group", default: null },
    billingPeriod: {
      type: Schema.Types.ObjectId,
      ref: "BillingPeriod",
      default: null,
    },
    targetMember: {
      type: Schema.Types.ObjectId,
      ref: "Group.members",
      default: null,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditEventSchema.index({ actor: 1 });
auditEventSchema.index({ group: 1 });
auditEventSchema.index({ action: 1 });
auditEventSchema.index({ createdAt: -1 });

export const AuditEvent =
  mongoose.models.AuditEvent ||
  mongoose.model<IAuditEvent>("AuditEvent", auditEventSchema);
