import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  role: "admin" | "user";
  emailVerified: Date | null;
  image: string | null;
  hashedPassword: string | null;
  telegram?: {
    chatId: number;
    username: string | null;
    linkedAt: Date | null;
  } | null;
  /** short code for Telegram deep link (start param allows only A-Za-z0-9_- and max 64 chars) */
  telegramLinkCode: {
    code: string;
    expiresAt: Date;
  } | null;
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
    role: { type: String, enum: ["admin", "user"], default: "user" },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },
    hashedPassword: { type: String, default: null },
    telegram: {
      type: new Schema(
        {
          chatId: { type: Number, required: true },
          username: { type: String, default: null },
          linkedAt: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: undefined,
    },
    telegramLinkCode: {
      type: new Schema(
        {
          code: { type: String, required: true },
          expiresAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: undefined,
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
userSchema.index(
  { "telegramLinkCode.code": 1 },
  { sparse: true, unique: true }
);

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
