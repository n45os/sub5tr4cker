import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  hashedPassword: string | null;
  telegram: {
    chatId: number | null;
    username: string | null;
    linkedAt: Date | null;
  };
  notificationPreferences: {
    email: boolean;
    telegram: boolean;
    reminderFrequency: "once" | "daily" | "every_3_days";
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },
    hashedPassword: { type: String, default: null },
    telegram: {
      chatId: { type: Number, default: null },
      username: { type: String, default: null },
      linkedAt: { type: Date, default: null },
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      telegram: { type: Boolean, default: false },
      reminderFrequency: {
        type: String,
        enum: ["once", "daily", "every_3_days"],
        default: "every_3_days",
      },
    },
  },
  { timestamps: true }
);

userSchema.index({ "telegram.chatId": 1 }, { sparse: true, unique: true });

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
