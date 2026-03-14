import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGroupMember {
  _id: Types.ObjectId;
  user: Types.ObjectId | null;
  email: string;
  nickname: string;
  role: "member" | "admin";
  joinedAt: Date;
  leftAt: Date | null;
  isActive: boolean;
  customAmount: number | null;
  acceptedAt: Date | null;
  /** when true, do not send reminder/invite/price-change emails to this member */
  unsubscribedFromEmail: boolean;
  /** first period this member owes; when null, billing starts from joinedAt */
  billingStartsAt: Date | null;
}

export interface IGroup extends Document {
  name: string;
  description: string | null;
  admin: Types.ObjectId;
  service: {
    name: string;
    icon: string | null;
    url: string | null;
    /** hex color (e.g. #3b82f6) used as accent in notification emails */
    accentColor: string | null;
  };
  billing: {
    mode: "equal_split" | "fixed_amount" | "variable";
    currentPrice: number;
    currency: string;
    cycleDay: number;
    cycleType: "monthly" | "yearly";
    adminIncludedInSplit: boolean;
    fixedMemberAmount: number | null;
    gracePeriodDays: number;
  };
  payment: {
    platform: "revolut" | "paypal" | "bank_transfer" | "stripe" | "custom";
    link: string | null;
    instructions: string | null;
    stripeAccountId: string | null;
  };
  notifications: {
    remindersEnabled: boolean;
    followUpsEnabled: boolean;
    priceChangeEnabled: boolean;
  };
  members: IGroupMember[];
  announcements: {
    notifyOnPriceChange: boolean;
    extraText: string | null;
  };
  telegramGroup: {
    chatId: number | null;
    linkedAt: Date | null;
  };
  isActive: boolean;
  inviteCode: string | null;
  inviteLinkEnabled: boolean;
  initializedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const groupMemberSchema = new Schema<IGroupMember>({
  user: { type: Schema.Types.ObjectId, ref: "User", default: null },
  email: { type: String, required: true },
  nickname: { type: String, required: true },
  role: { type: String, enum: ["member", "admin"], default: "member" },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  customAmount: { type: Number, default: null },
  acceptedAt: { type: Date, default: null },
  unsubscribedFromEmail: { type: Boolean, default: false },
  billingStartsAt: { type: Date, default: null },
});

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    service: {
      name: { type: String, required: true },
      icon: { type: String, default: null },
      url: { type: String, default: null },
      accentColor: { type: String, default: null },
    },
    billing: {
      mode: {
        type: String,
        enum: ["equal_split", "fixed_amount", "variable"],
        default: "equal_split",
      },
      currentPrice: { type: Number, required: true },
      currency: { type: String, default: "EUR" },
      cycleDay: { type: Number, default: 1, min: 1, max: 28 },
      cycleType: {
        type: String,
        enum: ["monthly", "yearly"],
        default: "monthly",
      },
      adminIncludedInSplit: { type: Boolean, default: true },
      fixedMemberAmount: { type: Number, default: null },
      gracePeriodDays: { type: Number, default: 3 },
    },
    payment: {
      platform: {
        type: String,
        enum: ["revolut", "paypal", "bank_transfer", "stripe", "custom"],
        default: "revolut",
      },
      link: { type: String, default: null },
      instructions: { type: String, default: null },
      stripeAccountId: { type: String, default: null },
    },
    notifications: {
      remindersEnabled: { type: Boolean, default: true },
      followUpsEnabled: { type: Boolean, default: true },
      priceChangeEnabled: { type: Boolean, default: true },
    },
    members: [groupMemberSchema],
    announcements: {
      notifyOnPriceChange: { type: Boolean, default: true },
      extraText: { type: String, default: null },
    },
    telegramGroup: {
      chatId: { type: Number, default: null },
      linkedAt: { type: Date, default: null },
    },
    isActive: { type: Boolean, default: true },
    inviteCode: { type: String, default: null },
    inviteLinkEnabled: { type: Boolean, default: false },
    initializedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

groupSchema.index({ admin: 1 });
groupSchema.index({ "members.user": 1 });
groupSchema.index({ "members.email": 1 });
groupSchema.index({ inviteCode: 1 }, { sparse: true, unique: true });

export const Group =
  mongoose.models.Group || mongoose.model<IGroup>("Group", groupSchema);
