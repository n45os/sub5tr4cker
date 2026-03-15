import mongoose, { Document, Schema } from "mongoose";
import type { SettingsCategory } from "@/lib/settings/definitions";

export interface ISettings extends Document {
  key: string;
  value: string | null;
  category: SettingsCategory;
  isSecret: boolean;
  label: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, default: null },
    category: {
      type: String,
      enum: ["general", "email", "telegram", "notifications", "security", "cron", "plugin"],
      required: true,
    },
    isSecret: { type: Boolean, default: false },
    label: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

// key is already unique via schema option; avoid duplicate index
settingsSchema.index({ category: 1 });

export const Settings =
  mongoose.models.Settings || mongoose.model<ISettings>("Settings", settingsSchema);
