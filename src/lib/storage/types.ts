/**
 * storage-agnostic domain types — no Mongoose Documents, no ObjectId.
 * all IDs are plain strings; adapters handle conversion from/to db-native id types.
 */

// ─── user ────────────────────────────────────────────────────────────────────

export interface StorageUser {
  id: string;
  name: string;
  email: string;
  /** n450s_auth identity sub — null in local mode, set in advanced mode after first federated login or migration */
  authIdentityId: string | null;
  role: "admin" | "user";
  emailVerified: Date | null;
  image: string | null;
  hashedPassword: string | null;
  telegram: {
    chatId: number;
    username: string | null;
    linkedAt: Date | null;
  } | null;
  telegramLinkCode: {
    code: string;
    expiresAt: Date;
  } | null;
  notificationPreferences: {
    email: boolean;
    telegram: boolean;
    reminderFrequency: "once" | "daily" | "every_3_days";
  };
  welcomeEmailSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** insert user (register) — adapter assigns id and timestamps in local mode */
export interface CreateUserInput {
  name: string;
  email: string;
  role: "admin" | "user";
  /** null when the account is created from an invite (magic login only) */
  hashedPassword: string | null;
  notificationPreferences: StorageUser["notificationPreferences"];
  /** set when provisioned from n450s_auth callback flow */
  authIdentityId?: string | null;
}

// ─── group ────────────────────────────────────────────────────────────────────

export interface StorageGroupMember {
  id: string;
  userId: string | null;
  email: string | null;
  nickname: string;
  role: "member" | "admin";
  joinedAt: Date;
  leftAt: Date | null;
  isActive: boolean;
  customAmount: number | null;
  acceptedAt: Date | null;
  unsubscribedFromEmail: boolean;
  billingStartsAt: Date | null;
}

export interface StorageGroup {
  id: string;
  name: string;
  description: string | null;
  adminId: string;
  service: {
    name: string;
    icon: string | null;
    url: string | null;
    accentColor: string | null;
    emailTheme: "clean" | "minimal" | "bold" | "rounded" | "corporate";
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
    paymentInAdvanceDays: number;
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
    saveEmailParams: boolean;
  };
  members: StorageGroupMember[];
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

/** group with member user records populated (needed for notification targeting) */
export interface StorageGroupWithUsers extends StorageGroup {
  memberUsers: Map<string, Pick<StorageUser, "telegram" | "notificationPreferences"> | null>;
}

// ─── billing period ───────────────────────────────────────────────────────────

export interface StorageMemberPayment {
  id: string;
  memberId: string;
  memberEmail: string | null;
  memberNickname: string;
  amount: number;
  adjustedAmount: number | null;
  adjustmentReason: string | null;
  status: "pending" | "member_confirmed" | "confirmed" | "overdue" | "waived";
  memberConfirmedAt: Date | null;
  adminConfirmedAt: Date | null;
  confirmationToken: string | null;
  notes: string | null;
}

export interface StorageReminderEntry {
  sentAt: Date;
  channel: "email" | "telegram";
  recipientCount: number;
  type: "initial" | "follow_up";
}

export interface StorageBillingPeriod {
  id: string;
  groupId: string;
  periodStart: Date;
  collectionOpensAt: Date | null;
  periodEnd: Date;
  periodLabel: string;
  totalPrice: number;
  currency: string;
  priceNote: string | null;
  payments: StorageMemberPayment[];
  reminders: StorageReminderEntry[];
  isFullyPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── notification ─────────────────────────────────────────────────────────────

export type StorageNotificationType =
  | "payment_reminder"
  | "payment_confirmed"
  | "admin_confirmation_request"
  | "price_change"
  | "price_adjustment"
  | "announcement"
  | "invite"
  | "follow_up"
  | "member_message";

export interface StorageNotification {
  id: string;
  recipientId: string | null;
  recipientEmail: string | null;
  recipientLabel: string;
  groupId: string | null;
  billingPeriodId: string | null;
  type: StorageNotificationType;
  channel: "email" | "telegram";
  status: "sent" | "failed" | "pending";
  subject: string | null;
  preview: string;
  emailParams: Record<string, unknown> | null;
  externalId: string | null;
  error: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

/** persisted app settings row (MongoDB in advanced mode; local mode uses config.json) */
export interface StorageAppSettingRow {
  key: string;
  value: string | null;
  category: string;
  isSecret: boolean;
  label: string;
  description: string;
}

// ─── audit ────────────────────────────────────────────────────────────────────

export type StorageAuditAction =
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
  | "period_dedup_hit"
  | "period_duplicate_merged";

export interface StorageAuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  action: StorageAuditAction;
  groupId: string | null;
  billingPeriodId: string | null;
  targetMemberId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ─── scheduled task ───────────────────────────────────────────────────────────

export type StorageTaskType =
  | "payment_reminder"
  | "aggregated_payment_reminder"
  | "admin_confirmation_request";

export type StorageTaskStatus =
  | "pending"
  | "locked"
  | "completed"
  | "failed"
  | "cancelled";

export interface StorageTaskPayload {
  groupId?: string;
  billingPeriodId?: string;
  memberId?: string;
  memberUserId?: string | null;
  paymentId?: string;
  channel?: "email" | "telegram";
  memberEmail?: string | null;
  recipientKey?: string;
  recipientLabel?: string;
  payments?: Array<{
    groupId: string;
    billingPeriodId: string;
    memberId: string;
    paymentId: string;
  }>;
  [key: string]: unknown;
}

export interface StorageScheduledTask {
  id: string;
  type: StorageTaskType;
  status: StorageTaskStatus;
  runAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  idempotencyKey: string;
  payload: StorageTaskPayload;
  createdAt: Date;
  updatedAt: Date;
}

// ─── price history ────────────────────────────────────────────────────────────

export interface StoragePriceHistory {
  id: string;
  groupId: string;
  price: number;
  previousPrice: number | null;
  currency: string;
  effectiveFrom: Date;
  note: string | null;
  membersNotified: boolean;
  createdBy: string;
  createdAt: Date;
}

// ─── input types (for create operations) ─────────────────────────────────────

export type CreateGroupInput = Omit<StorageGroup, "id" | "createdAt" | "updatedAt">;

export type UpdateGroupInput = Partial<Omit<StorageGroup, "id" | "createdAt" | "updatedAt">>;

export type CreateBillingPeriodInput = Omit<StorageBillingPeriod, "id" | "createdAt" | "updatedAt">;

export type UpdateBillingPeriodInput = Partial<Omit<StorageBillingPeriod, "id" | "groupId" | "createdAt" | "updatedAt">>;

export interface PaymentStatusUpdate {
  status?: StorageMemberPayment["status"];
  memberConfirmedAt?: Date | null;
  adminConfirmedAt?: Date | null;
  confirmationToken?: string | null;
  notes?: string | null;
  adjustedAmount?: number | null;
  adjustmentReason?: string | null;
}

export interface CreateNotificationInput {
  recipientId?: string | null;
  recipientEmail?: string | null;
  recipientLabel: string;
  groupId?: string | null;
  billingPeriodId?: string | null;
  type: StorageNotificationType;
  channel: "email" | "telegram";
  status: "sent" | "failed" | "pending";
  subject?: string | null;
  preview: string;
  emailParams?: Record<string, unknown> | null;
  externalId?: string | null;
  error?: string | null;
  deliveredAt?: Date | null;
}

export interface CreateAuditEventInput {
  actorId: string;
  actorName: string;
  action: StorageAuditAction;
  groupId?: string | null;
  billingPeriodId?: string | null;
  targetMemberId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateTaskInput {
  type: StorageTaskType;
  runAt: Date;
  payload: StorageTaskPayload;
  maxAttempts?: number;
  idempotencyKey: string;
}

export interface CreatePriceHistoryInput {
  groupId: string;
  price: number;
  previousPrice: number | null;
  currency: string;
  effectiveFrom: Date;
  note?: string | null;
  membersNotified?: boolean;
  createdBy: string;
}

// ─── query types ──────────────────────────────────────────────────────────────

export interface OpenPeriodsFilter {
  /** if provided, only return periods for these group IDs */
  groupIds?: string[];
  /** now — periods where collectionOpensAt (or periodStart) <= this date */
  asOf: Date;
  /** only return periods that are not fully paid */
  unpaidOnly?: boolean;
}

// ─── data portability ─────────────────────────────────────────────────────────

export interface ExportBundle {
  /** semver schema version for forward compatibility */
  version: string;
  exportedAt: string;
  source: {
    mode: "local" | "advanced";
    appVersion: string;
  };
  data: {
    groups: StorageGroup[];
    billingPeriods: StorageBillingPeriod[];
    notifications: StorageNotification[];
    priceHistory: StoragePriceHistory[];
  };
}

export interface ImportResult {
  groups: number;
  billingPeriods: number;
  notifications: number;
  priceHistory: number;
  errors: string[];
}
