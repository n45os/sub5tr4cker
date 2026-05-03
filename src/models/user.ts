import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  /** n450s_auth identity sub — primary identity bridge once federated */
  authIdentityId: string | null;
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
  /** set when the user has received the one-time welcome/invite email (magic link or Telegram onboarding) */
  welcomeEmailSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    authIdentityId: { type: String, default: null },
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
    welcomeEmailSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ "telegram.chatId": 1 }, { sparse: true, unique: true });
userSchema.index(
  { "telegramLinkCode.code": 1 },
  { sparse: true, unique: true }
);
userSchema.index({ authIdentityId: 1 }, { sparse: true, unique: true });

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
