import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPriceHistory extends Document {
  group: Types.ObjectId;
  price: number;
  previousPrice: number | null;
  currency: string;
  effectiveFrom: Date;
  note: string | null;
  membersNotified: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const priceHistorySchema = new Schema<IPriceHistory>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    price: { type: Number, required: true },
    previousPrice: { type: Number, default: null },
    currency: { type: String, default: "EUR" },
    effectiveFrom: { type: Date, required: true },
    note: { type: String, default: null },
    membersNotified: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

priceHistorySchema.index({ group: 1, effectiveFrom: 1 });

export const PriceHistory =
  mongoose.models.PriceHistory ||
  mongoose.model<IPriceHistory>("PriceHistory", priceHistorySchema);
