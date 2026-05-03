import { Types } from "mongoose";
import { dbConnect } from "@/lib/db/mongoose";
import {
  Group,
  BillingPeriod,
  Notification,
  AuditEvent,
  ScheduledTask,
  PriceHistory,
  User,
  Settings,
} from "@/models";
import type { IGroup, IGroupMember } from "@/models/group";
import type { IBillingPeriod, IMemberPayment } from "@/models/billing-period";
import type { INotification } from "@/models/notification";
import type { IScheduledTask } from "@/models/scheduled-task";
import type { IPriceHistory } from "@/models/price-history";
import type { IUser } from "@/models/user";
import type { ISettings } from "@/models/settings";
import { settingsDefinitions } from "@/lib/settings/definitions";
import { collectionWindowOpenFilter } from "@/lib/billing/collection-window";
import type { StorageAdapter } from "./adapter";
import type {
  StorageUser,
  StorageGroup,
  StorageGroupMember,
  StorageGroupWithUsers,
  StorageBillingPeriod,
  StorageMemberPayment,
  StorageReminderEntry,
  StorageNotification,
  StorageAuditEvent,
  StorageScheduledTask,
  StoragePriceHistory,
  CreateGroupInput,
  UpdateGroupInput,
  CreateBillingPeriodInput,
  UpdateBillingPeriodInput,
  PaymentStatusUpdate,
  CreateNotificationInput,
  CreateAuditEventInput,
  CreateTaskInput,
  CreatePriceHistoryInput,
  CreateUserInput,
  OpenPeriodsFilter,
  ExportBundle,
  ImportResult,
  StorageNotificationType,
  StorageAppSettingRow,
} from "./types";

// ── conversion helpers ────────────────────────────────────────────────────────

function toId(v: unknown): string {
  if (v instanceof Types.ObjectId) return v.toString();
  if (typeof v === "string") return v;
  return String(v);
}

function toIdOrNull(v: unknown): string | null {
  if (!v) return null;
  return toId(v);
}

function userToStorage(u: IUser): StorageUser {
  return {
    id: toId(u._id),
    name: u.name,
    email: u.email,
    authIdentityId: u.authIdentityId ?? null,
    role: u.role,
    emailVerified: u.emailVerified,
    image: u.image,
    hashedPassword: u.hashedPassword,
    telegram: u.telegram
      ? {
          chatId: u.telegram.chatId,
          username: u.telegram.username,
          linkedAt: u.telegram.linkedAt,
        }
      : null,
    telegramLinkCode: u.telegramLinkCode
      ? { code: u.telegramLinkCode.code, expiresAt: u.telegramLinkCode.expiresAt }
      : null,
    notificationPreferences: {
      email: u.notificationPreferences?.email ?? true,
      telegram: u.notificationPreferences?.telegram ?? false,
      reminderFrequency: u.notificationPreferences?.reminderFrequency ?? "every_3_days",
    },
    welcomeEmailSentAt: u.welcomeEmailSentAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function memberToStorage(m: IGroupMember): StorageGroupMember {
  return {
    id: toId(m._id),
    userId: toIdOrNull(m.user),
    email: m.email ?? null,
    nickname: m.nickname,
    role: m.role,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt,
    isActive: m.isActive,
    customAmount: m.customAmount,
    acceptedAt: m.acceptedAt,
    unsubscribedFromEmail: m.unsubscribedFromEmail,
    billingStartsAt: m.billingStartsAt,
  };
}

function groupToStorage(g: IGroup): StorageGroup {
  return {
    id: toId(g._id),
    name: g.name,
    description: g.description,
    adminId: toId(g.admin),
    service: {
      name: g.service.name,
      icon: g.service.icon,
      url: g.service.url,
      accentColor: g.service.accentColor,
      emailTheme: g.service.emailTheme,
    },
    billing: {
      mode: g.billing.mode,
      currentPrice: g.billing.currentPrice,
      currency: g.billing.currency,
      cycleDay: g.billing.cycleDay,
      cycleType: g.billing.cycleType,
      adminIncludedInSplit: g.billing.adminIncludedInSplit,
      fixedMemberAmount: g.billing.fixedMemberAmount,
      gracePeriodDays: g.billing.gracePeriodDays,
      paymentInAdvanceDays: g.billing.paymentInAdvanceDays,
    },
    payment: {
      platform: g.payment.platform,
      link: g.payment.link,
      instructions: g.payment.instructions,
      stripeAccountId: g.payment.stripeAccountId,
    },
    notifications: {
      remindersEnabled: g.notifications.remindersEnabled,
      followUpsEnabled: g.notifications.followUpsEnabled,
      priceChangeEnabled: g.notifications.priceChangeEnabled,
      saveEmailParams: g.notifications.saveEmailParams,
    },
    members: g.members.map(memberToStorage),
    announcements: {
      notifyOnPriceChange: g.announcements?.notifyOnPriceChange ?? true,
      extraText: g.announcements?.extraText ?? null,
    },
    telegramGroup: {
      chatId: g.telegramGroup?.chatId ?? null,
      linkedAt: g.telegramGroup?.linkedAt ?? null,
    },
    isActive: g.isActive,
    inviteCode: g.inviteCode,
    inviteLinkEnabled: g.inviteLinkEnabled,
    initializedAt: g.initializedAt,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

function paymentToStorage(p: IMemberPayment): StorageMemberPayment {
  return {
    id: toId(p._id),
    memberId: toId(p.memberId),
    memberEmail: p.memberEmail ?? null,
    memberNickname: p.memberNickname,
    amount: p.amount,
    adjustedAmount: p.adjustedAmount,
    adjustmentReason: p.adjustmentReason,
    status: p.status,
    memberConfirmedAt: p.memberConfirmedAt,
    adminConfirmedAt: p.adminConfirmedAt,
    confirmationToken: p.confirmationToken,
    notes: p.notes,
  };
}

function periodToStorage(p: IBillingPeriod): StorageBillingPeriod {
  return {
    id: toId(p._id),
    groupId: toId(p.group),
    periodStart: p.periodStart,
    collectionOpensAt: p.collectionOpensAt ?? null,
    periodEnd: p.periodEnd,
    periodLabel: p.periodLabel,
    totalPrice: p.totalPrice,
    currency: p.currency,
    priceNote: p.priceNote,
    payments: p.payments.map(paymentToStorage),
    reminders: p.reminders.map((r): StorageReminderEntry => ({
      sentAt: r.sentAt,
      channel: r.channel,
      recipientCount: r.recipientCount,
      type: r.type,
    })),
    isFullyPaid: p.isFullyPaid,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function notificationToStorage(n: INotification): StorageNotification {
  return {
    id: toId(n._id),
    recipientId: toIdOrNull(n.recipient),
    recipientEmail: n.recipientEmail ?? null,
    recipientLabel: n.recipientLabel,
    groupId: toIdOrNull(n.group),
    billingPeriodId: toIdOrNull(n.billingPeriod),
    type: n.type,
    channel: n.channel,
    status: n.status,
    subject: n.subject,
    preview: n.preview,
    emailParams: n.emailParams ?? null,
    externalId: n.externalId,
    error: n.error,
    deliveredAt: n.deliveredAt,
    createdAt: n.createdAt,
  };
}

function auditEventToStorage(event: {
  _id: unknown;
  actor: unknown;
  actorName: string;
  action: string;
  group?: unknown;
  billingPeriod?: unknown;
  targetMember?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}): StorageAuditEvent {
  return {
    id: toId(event._id),
    actorId: toId(event.actor),
    actorName: event.actorName,
    action: event.action as StorageAuditEvent["action"],
    groupId: toIdOrNull(event.group),
    billingPeriodId: toIdOrNull(event.billingPeriod),
    targetMemberId: toIdOrNull(event.targetMember),
    metadata: event.metadata ?? {},
    createdAt: event.createdAt,
  };
}

function taskToStorage(t: IScheduledTask): StorageScheduledTask {
  return {
    id: toId(t._id),
    type: t.type,
    status: t.status,
    runAt: t.runAt,
    lockedAt: t.lockedAt,
    lockedBy: t.lockedBy,
    attempts: t.attempts,
    maxAttempts: t.maxAttempts,
    lastError: t.lastError,
    completedAt: t.completedAt,
    cancelledAt: t.cancelledAt ?? null,
    idempotencyKey: t.idempotencyKey,
    payload: t.payload,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function priceHistoryToStorage(p: IPriceHistory): StoragePriceHistory {
  return {
    id: toId(p._id),
    groupId: toId(p.group),
    price: p.price,
    previousPrice: p.previousPrice,
    currency: p.currency,
    effectiveFrom: p.effectiveFrom,
    note: p.note,
    membersNotified: p.membersNotified,
    createdBy: toId(p.createdBy),
    createdAt: p.createdAt,
  };
}

const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;

// ── adapter ───────────────────────────────────────────────────────────────────

export class MongooseAdapter implements StorageAdapter {
  async initialize(): Promise<void> {
    await dbConnect();
  }

  async close(): Promise<void> {
    // mongoose connection is managed globally; no-op here
  }

  // ── users ──────────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<StorageUser | null> {
    await dbConnect();
    const u = await User.findById(id).lean<IUser>();
    return u ? userToStorage(u) : null;
  }

  async getUserByEmail(email: string): Promise<StorageUser | null> {
    await dbConnect();
    const u = await User.findOne({ email: email.toLowerCase().trim() }).lean<IUser>();
    return u ? userToStorage(u) : null;
  }

  async getUserByTelegramChatId(chatId: number): Promise<StorageUser | null> {
    await dbConnect();
    const u = await User.findOne({ "telegram.chatId": chatId }).lean<IUser>();
    return u ? userToStorage(u) : null;
  }

  async getUserByAuthIdentityId(sub: string): Promise<StorageUser | null> {
    await dbConnect();
    const u = await User.findOne({ authIdentityId: sub }).lean<IUser>();
    return u ? userToStorage(u) : null;
  }

  async updateUser(
    id: string,
    data: Partial<Omit<StorageUser, "id" | "createdAt">>
  ): Promise<StorageUser> {
    await dbConnect();
    const updated = await User.findByIdAndUpdate(id, { $set: data }, { new: true }).lean<IUser>();
    if (!updated) throw new Error(`user not found: ${id}`);
    return userToStorage(updated);
  }

  async createUser(data: CreateUserInput): Promise<StorageUser> {
    await dbConnect();
    const u = await User.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      authIdentityId: data.authIdentityId ?? null,
      role: data.role,
      hashedPassword: data.hashedPassword,
      notificationPreferences: data.notificationPreferences,
    });
    const lean = await User.findById(u._id).lean<IUser>();
    if (!lean) throw new Error("user create failed");
    return userToStorage(lean);
  }

  async countUsers(): Promise<number> {
    await dbConnect();
    return User.countDocuments();
  }

  async getAdminUserCount(): Promise<number> {
    await dbConnect();
    return User.countDocuments({ role: "admin" });
  }

  async promoteOldestUserToAdmin(): Promise<void> {
    await dbConnect();
    const oldest = await User.findOne().sort({ createdAt: 1 }).select("_id").lean<IUser>();
    if (!oldest?._id) return;
    await User.updateOne({ _id: oldest._id }, { $set: { role: "admin" } });
  }

  async linkTelegramAccountWithLinkCode(params: {
    code: string;
    chatId: number;
    username: string | null;
    now: Date;
  }): Promise<StorageUser | null> {
    await dbConnect();
    const { code, chatId, username, now } = params;
    const user = await User.findOneAndUpdate(
      {
        "telegramLinkCode.code": code,
        "telegramLinkCode.expiresAt": { $gt: now },
      },
      {
        $set: {
          telegram: { chatId, username, linkedAt: now },
          "notificationPreferences.telegram": true,
        },
        $unset: { telegramLinkCode: "" },
      },
      { new: true }
    ).lean<IUser | null>();
    return user ? userToStorage(user) : null;
  }

  async tryClaimWelcomeEmailSentAt(userId: string, at: Date): Promise<boolean> {
    await dbConnect();
    const prev = await User.findOneAndUpdate(
      { _id: userId, welcomeEmailSentAt: null },
      { $set: { welcomeEmailSentAt: at } },
      { new: false }
    ).lean<IUser | null>();
    return prev != null;
  }

  // ── groups ─────────────────────────────────────────────────────────────────

  async createGroup(data: CreateGroupInput): Promise<StorageGroup> {
    await dbConnect();
    const members = data.members.map((m) => ({
      user: m.userId ? new Types.ObjectId(m.userId) : null,
      email: m.email,
      nickname: m.nickname,
      role: m.role,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
      isActive: m.isActive,
      customAmount: m.customAmount,
      acceptedAt: m.acceptedAt,
      unsubscribedFromEmail: m.unsubscribedFromEmail,
      billingStartsAt: m.billingStartsAt,
    }));
    const g = await Group.create({
      name: data.name,
      description: data.description,
      admin: new Types.ObjectId(data.adminId),
      service: data.service,
      billing: data.billing,
      payment: data.payment,
      notifications: data.notifications,
      members,
      announcements: data.announcements,
      telegramGroup: data.telegramGroup,
      isActive: data.isActive,
      inviteCode: data.inviteCode,
      inviteLinkEnabled: data.inviteLinkEnabled,
      initializedAt: data.initializedAt,
    });
    return groupToStorage(g);
  }

  async getGroup(id: string): Promise<StorageGroup | null> {
    await dbConnect();
    const g = await Group.findById(id).lean<IGroup>();
    return g ? groupToStorage(g) : null;
  }

  async getGroupWithMemberUsers(id: string): Promise<StorageGroupWithUsers | null> {
    await dbConnect();
    const g = await Group.findById(id)
      .populate<{ members: (IGroupMember & { user: IUser | null })[] }>({
        path: "members.user",
        model: "User",
        select: "telegram notificationPreferences",
      })
      .lean();

    if (!g) return null;

    const base = groupToStorage(g as unknown as IGroup);
    const memberUsers = new Map<string, Pick<StorageUser, "telegram" | "notificationPreferences"> | null>();

    for (const m of (g as unknown as { members: (IGroupMember & { user: IUser | null })[] }).members) {
      const memberId = toId(m._id);
      if (m.user && typeof m.user === "object" && "notificationPreferences" in m.user) {
        const u = m.user as IUser;
        memberUsers.set(memberId, {
          telegram: u.telegram
            ? { chatId: u.telegram.chatId, username: u.telegram.username, linkedAt: u.telegram.linkedAt }
            : null,
          notificationPreferences: {
            email: u.notificationPreferences?.email ?? true,
            telegram: u.notificationPreferences?.telegram ?? false,
            reminderFrequency: u.notificationPreferences?.reminderFrequency ?? "every_3_days",
          },
        });
      } else {
        memberUsers.set(memberId, null);
      }
    }

    return { ...base, memberUsers };
  }

  async listGroupsForUser(userId: string, email: string): Promise<StorageGroup[]> {
    await dbConnect();
    const groups = await Group.find({
      isActive: true,
      $or: [
        { admin: userId },
        { "members.user": userId },
        { "members.email": email, "members.isActive": true },
      ],
    }).lean<IGroup[]>().exec();
    return groups.map(groupToStorage);
  }

  async listAllActiveGroups(): Promise<StorageGroup[]> {
    await dbConnect();
    const groups = await Group.find({ isActive: true }).lean<IGroup[]>().exec();
    return groups.map(groupToStorage);
  }

  async updateGroup(id: string, data: UpdateGroupInput): Promise<StorageGroup> {
    await dbConnect();
    // build a flat $set to only update provided fields
    const setFields: Record<string, unknown> = {};
    if (data.name !== undefined) setFields.name = data.name;
    if (data.description !== undefined) setFields.description = data.description;
    if (data.service !== undefined) setFields.service = data.service;
    if (data.billing !== undefined) setFields.billing = data.billing;
    if (data.payment !== undefined) setFields.payment = data.payment;
    if (data.notifications !== undefined) setFields.notifications = data.notifications;
    if (data.announcements !== undefined) setFields.announcements = data.announcements;
    if (data.telegramGroup !== undefined) setFields.telegramGroup = data.telegramGroup;
    if (data.isActive !== undefined) setFields.isActive = data.isActive;
    if (data.inviteCode !== undefined) setFields.inviteCode = data.inviteCode;
    if (data.inviteLinkEnabled !== undefined) setFields.inviteLinkEnabled = data.inviteLinkEnabled;
    if (data.initializedAt !== undefined) setFields.initializedAt = data.initializedAt;
    if (data.members !== undefined) {
      setFields.members = data.members.map((m) => ({
        _id: m.id ? new Types.ObjectId(m.id) : undefined,
        user: m.userId ? new Types.ObjectId(m.userId) : null,
        email: m.email,
        nickname: m.nickname,
        role: m.role,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt,
        isActive: m.isActive,
        customAmount: m.customAmount,
        acceptedAt: m.acceptedAt,
        unsubscribedFromEmail: m.unsubscribedFromEmail,
        billingStartsAt: m.billingStartsAt,
      }));
    }
    const updated = await Group.findByIdAndUpdate(id, { $set: setFields }, { new: true }).lean<IGroup>();
    if (!updated) throw new Error(`group not found: ${id}`);
    return groupToStorage(updated);
  }

  async softDeleteGroup(id: string): Promise<void> {
    await dbConnect();
    await Group.findByIdAndUpdate(id, { $set: { isActive: false } });
  }

  async findGroupByInviteCode(code: string): Promise<StorageGroup | null> {
    await dbConnect();
    const g = await Group.findOne({ inviteCode: code }).lean<IGroup>();
    return g ? groupToStorage(g) : null;
  }

  async findActiveGroupForMemberInvitation(params: {
    groupId?: string | null;
    memberId: string;
  }): Promise<StorageGroup | null> {
    await dbConnect();
    const { groupId, memberId } = params;
    if (groupId) {
      const g = await Group.findOne({ _id: groupId, isActive: true }).lean<IGroup>();
      if (!g) return null;
      const storage = groupToStorage(g);
      const m = storage.members.find(
        (mm) => mm.id === memberId && mm.isActive && !mm.leftAt
      );
      return m ? storage : null;
    }
    if (Types.ObjectId.isValid(memberId)) {
      const g = await Group.findOne({
        isActive: true,
        "members._id": new Types.ObjectId(memberId),
      }).lean<IGroup>();
      return g ? groupToStorage(g) : null;
    }
    return null;
  }

  // ── billing periods ────────────────────────────────────────────────────────

  async createBillingPeriod(data: CreateBillingPeriodInput): Promise<StorageBillingPeriod> {
    await dbConnect();
    const payments = data.payments.map((p) => ({
      memberId: new Types.ObjectId(p.memberId),
      memberEmail: p.memberEmail,
      memberNickname: p.memberNickname,
      amount: p.amount,
      adjustedAmount: p.adjustedAmount,
      adjustmentReason: p.adjustmentReason,
      status: p.status,
      memberConfirmedAt: p.memberConfirmedAt,
      adminConfirmedAt: p.adminConfirmedAt,
      confirmationToken: p.confirmationToken,
      notes: p.notes,
    }));
    const period = await BillingPeriod.create({
      group: new Types.ObjectId(data.groupId),
      periodStart: data.periodStart,
      collectionOpensAt: data.collectionOpensAt,
      periodEnd: data.periodEnd,
      periodLabel: data.periodLabel,
      totalPrice: data.totalPrice,
      currency: data.currency,
      priceNote: data.priceNote,
      payments,
      reminders: data.reminders,
      isFullyPaid: data.isFullyPaid,
    });
    return periodToStorage(period);
  }

  async getBillingPeriod(id: string, groupId: string): Promise<StorageBillingPeriod | null> {
    await dbConnect();
    const p = await BillingPeriod.findOne({ _id: id, group: groupId }).lean<IBillingPeriod>();
    return p ? periodToStorage(p) : null;
  }

  async getBillingPeriodByStart(groupId: string, periodStart: Date): Promise<StorageBillingPeriod | null> {
    await dbConnect();
    const p = await BillingPeriod.findOne({ group: groupId, periodStart }).lean<IBillingPeriod>();
    return p ? periodToStorage(p) : null;
  }

  async getBillingPeriodById(id: string): Promise<StorageBillingPeriod | null> {
    await dbConnect();
    const p = await BillingPeriod.findById(id).lean<IBillingPeriod>();
    return p ? periodToStorage(p) : null;
  }

  async getOpenBillingPeriods(filter: OpenPeriodsFilter): Promise<StorageBillingPeriod[]> {
    await dbConnect();
    const query: Record<string, unknown> = {
      ...collectionWindowOpenFilter(filter.asOf),
    };
    if (filter.unpaidOnly) query.isFullyPaid = false;
    if (filter.groupIds && filter.groupIds.length > 0) {
      query.group = { $in: filter.groupIds.map((id) => new Types.ObjectId(id)) };
    }
    const periods = await BillingPeriod.find(query).lean<IBillingPeriod[]>();
    return periods.map(periodToStorage);
  }

  async getPeriodsForGroup(groupId: string): Promise<StorageBillingPeriod[]> {
    await dbConnect();
    const periods = await BillingPeriod.find({ group: groupId })
      .sort({ periodStart: -1 })
      .lean<IBillingPeriod[]>();
    return periods.map(periodToStorage);
  }

  async listUnpaidPeriodsWithStartBefore(asOf: Date): Promise<StorageBillingPeriod[]> {
    await dbConnect();
    const periods = await BillingPeriod.find({
      isFullyPaid: false,
      periodStart: { $lt: asOf },
    })
      .lean<IBillingPeriod[]>();
    return periods.map(periodToStorage);
  }

  async getFuturePeriods(groupId: string, afterDate: Date): Promise<StorageBillingPeriod[]> {
    await dbConnect();
    const periods = await BillingPeriod.find({
      group: groupId,
      periodStart: { $gt: afterDate },
    })
      .sort({ periodStart: 1 })
      .lean<IBillingPeriod[]>();
    return periods.map(periodToStorage);
  }

  async updateBillingPeriod(id: string, data: UpdateBillingPeriodInput): Promise<StorageBillingPeriod> {
    await dbConnect();
    const setFields: Record<string, unknown> = {};
    if (data.periodStart !== undefined) setFields.periodStart = data.periodStart;
    if (data.collectionOpensAt !== undefined) setFields.collectionOpensAt = data.collectionOpensAt;
    if (data.periodEnd !== undefined) setFields.periodEnd = data.periodEnd;
    if (data.periodLabel !== undefined) setFields.periodLabel = data.periodLabel;
    if (data.totalPrice !== undefined) setFields.totalPrice = data.totalPrice;
    if (data.currency !== undefined) setFields.currency = data.currency;
    if (data.priceNote !== undefined) setFields.priceNote = data.priceNote;
    if (data.isFullyPaid !== undefined) setFields.isFullyPaid = data.isFullyPaid;
    if (data.reminders !== undefined) setFields.reminders = data.reminders;
    if (data.payments !== undefined) {
      setFields.payments = data.payments.map((p) => ({
        _id: p.id ? new Types.ObjectId(p.id) : undefined,
        memberId: new Types.ObjectId(p.memberId),
        memberEmail: p.memberEmail,
        memberNickname: p.memberNickname,
        amount: p.amount,
        adjustedAmount: p.adjustedAmount,
        adjustmentReason: p.adjustmentReason,
        status: p.status,
        memberConfirmedAt: p.memberConfirmedAt,
        adminConfirmedAt: p.adminConfirmedAt,
        confirmationToken: p.confirmationToken,
        notes: p.notes,
      }));
    }
    const updated = await BillingPeriod.findByIdAndUpdate(id, { $set: setFields }, { new: true }).lean<IBillingPeriod>();
    if (!updated) throw new Error(`billing period not found: ${id}`);
    return periodToStorage(updated);
  }

  async deleteBillingPeriod(id: string, groupId: string): Promise<void> {
    await dbConnect();
    await BillingPeriod.findOneAndDelete({ _id: id, group: groupId });
  }

  async updatePaymentStatus(
    periodId: string,
    memberId: string,
    update: PaymentStatusUpdate
  ): Promise<StorageBillingPeriod> {
    await dbConnect();
    const period = await BillingPeriod.findById(periodId);
    if (!period) throw new Error(`billing period not found: ${periodId}`);
    const payment = period.payments.find(
      (p: IMemberPayment) => p.memberId.toString() === memberId
    );
    if (!payment) throw new Error(`payment not found for member ${memberId} in period ${periodId}`);
    if (update.status !== undefined) payment.status = update.status;
    if (update.memberConfirmedAt !== undefined) payment.memberConfirmedAt = update.memberConfirmedAt;
    if (update.adminConfirmedAt !== undefined) payment.adminConfirmedAt = update.adminConfirmedAt;
    if (update.confirmationToken !== undefined) payment.confirmationToken = update.confirmationToken;
    if (update.notes !== undefined) payment.notes = update.notes;
    if (update.adjustedAmount !== undefined) payment.adjustedAmount = update.adjustedAmount;
    if (update.adjustmentReason !== undefined) payment.adjustmentReason = update.adjustmentReason;
    period.isFullyPaid = period.payments.every(
      (p: IMemberPayment) => p.status === "confirmed" || p.status === "waived"
    );
    await period.save();
    return periodToStorage(period);
  }

  async getBillingPeriodByConfirmationToken(
    token: string
  ): Promise<{ period: StorageBillingPeriod; paymentIndex: number } | null> {
    await dbConnect();
    const period = await BillingPeriod.findOne({
      "payments.confirmationToken": token,
    });
    if (!period) return null;
    const paymentIndex = period.payments.findIndex(
      (p: IMemberPayment) => p.confirmationToken === token
    );
    if (paymentIndex === -1) return null;
    return { period: periodToStorage(period), paymentIndex };
  }

  // ── notifications ──────────────────────────────────────────────────────────

  async logNotification(data: CreateNotificationInput): Promise<StorageNotification> {
    await dbConnect();
    const n = await Notification.create({
      recipient: data.recipientId ? new Types.ObjectId(data.recipientId) : null,
      recipientEmail: data.recipientEmail ?? null,
      recipientLabel: data.recipientLabel,
      group: data.groupId ? new Types.ObjectId(data.groupId) : null,
      billingPeriod: data.billingPeriodId ? new Types.ObjectId(data.billingPeriodId) : null,
      type: data.type,
      channel: data.channel,
      status: data.status,
      subject: data.subject ?? null,
      preview: data.preview,
      emailParams: data.emailParams ?? null,
      externalId: data.externalId ?? null,
      error: data.error ?? null,
      deliveredAt: data.deliveredAt ?? null,
    });
    return notificationToStorage(n);
  }

  async getNotificationsForGroup(groupId: string, limit = 50): Promise<StorageNotification[]> {
    await dbConnect();
    const ns = await Notification.find({ group: groupId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<INotification[]>();
    return ns.map(notificationToStorage);
  }

  async getNotificationById(id: string): Promise<StorageNotification | null> {
    await dbConnect();
    const n = await Notification.findById(id).lean<INotification>();
    return n ? notificationToStorage(n) : null;
  }

  async listNotifications(options: {
    groupIds: string[];
    type?: StorageNotificationType;
    channel?: "email" | "telegram";
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: StorageNotification[]; total: number }> {
    await dbConnect();
    const { groupIds, type, channel, limit, offset } = options;
    if (!groupIds.length) {
      return { notifications: [], total: 0 };
    }
    const filter: Record<string, unknown> = {
      group: { $in: groupIds.map((gid) => new Types.ObjectId(gid)) },
    };
    if (type) filter.type = type;
    if (channel) filter.channel = channel;

    let query = Notification.find(filter).sort({ createdAt: -1 });
    if (offset !== undefined) query = query.skip(offset);
    if (limit !== undefined) query = query.limit(limit);

    const [total, rows] = await Promise.all([
      Notification.countDocuments(filter),
      query.lean<INotification[]>(),
    ]);
    return { total, notifications: rows.map(notificationToStorage) };
  }

  async logAudit(data: CreateAuditEventInput): Promise<StorageAuditEvent> {
    await dbConnect();
    const event = await AuditEvent.create({
      actor: new Types.ObjectId(data.actorId),
      actorName: data.actorName,
      action: data.action,
      group: data.groupId ? new Types.ObjectId(data.groupId) : undefined,
      billingPeriod: data.billingPeriodId ? new Types.ObjectId(data.billingPeriodId) : undefined,
      targetMember: data.targetMemberId ? data.targetMemberId : undefined,
      metadata: data.metadata ?? {},
    });
    return auditEventToStorage(event.toObject());
  }

  async listAuditEvents(options: {
    groupIds?: string[];
    limit?: number;
    offset?: number;
    unbounded?: boolean;
  } = {}): Promise<{ events: StorageAuditEvent[]; total: number }> {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    if (options.groupIds?.length) {
      filter.group = { $in: options.groupIds.map((id) => new Types.ObjectId(id)) };
    }

    const unbounded = options.unbounded === true;
    const limit = unbounded ? undefined : (options.limit ?? 50);
    const offset = unbounded ? undefined : (options.offset ?? 0);
    let findQuery = AuditEvent.find(filter).sort({ createdAt: -1 });
    if (offset !== undefined) findQuery = findQuery.skip(offset);
    if (limit !== undefined) findQuery = findQuery.limit(limit);

    const [total, rows] = await Promise.all([
      AuditEvent.countDocuments(filter),
      findQuery.lean(),
    ]);

    return {
      total,
      events: rows.map((row) =>
        auditEventToStorage(row as unknown as Parameters<typeof auditEventToStorage>[0])
      ),
    };
  }

  // ── scheduled tasks ────────────────────────────────────────────────────────

  async enqueueTask(data: CreateTaskInput): Promise<StorageScheduledTask | null> {
    await dbConnect();
    const existing = await ScheduledTask.findOne({ idempotencyKey: data.idempotencyKey });
    if (existing) return null;
    const t = await ScheduledTask.create({
      type: data.type,
      status: "pending",
      runAt: data.runAt,
      payload: data.payload,
      idempotencyKey: data.idempotencyKey,
      maxAttempts: data.maxAttempts ?? 5,
    });
    return taskToStorage(t);
  }

  async claimTasks(
    workerId: string,
    options: { limit?: number; lockTtlMs?: number; recoverStaleLocks?: boolean } = {}
  ): Promise<StorageScheduledTask[]> {
    await dbConnect();
    const limit = options.limit ?? DEFAULT_BATCH_SIZE;
    const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - lockTtlMs);

    if (options.recoverStaleLocks) {
      await ScheduledTask.updateMany(
        { status: "locked", lockedAt: { $lt: staleThreshold } },
        { $set: { status: "pending", lockedAt: null, lockedBy: null } }
      );
    }

    const tasks: StorageScheduledTask[] = [];
    const cursor = ScheduledTask.find({ status: "pending", runAt: { $lte: now } })
      .sort({ runAt: 1 })
      .limit(limit)
      .cursor();

    for await (const task of cursor) {
      const updated = await ScheduledTask.findOneAndUpdate(
        { _id: task._id, status: "pending" },
        { $set: { status: "locked", lockedAt: now, lockedBy: workerId } },
        { returnDocument: "after" }
      );
      if (updated) tasks.push(taskToStorage(updated));
    }

    return tasks;
  }

  async completeTask(taskId: string): Promise<void> {
    await dbConnect();
    await ScheduledTask.findByIdAndUpdate(taskId, {
      $set: { status: "completed", completedAt: new Date(), lockedAt: null, lockedBy: null },
    });
  }

  async failTask(taskId: string, error: string, attempts: number, maxAttempts: number): Promise<void> {
    await dbConnect();
    if (attempts >= maxAttempts) {
      await ScheduledTask.findByIdAndUpdate(taskId, {
        $set: { status: "failed", lastError: error, attempts, lockedAt: null, lockedBy: null },
      });
      return;
    }
    const backoffMs = Math.min(2 ** attempts * 60 * 1000, 24 * 60 * 60 * 1000);
    await ScheduledTask.findByIdAndUpdate(taskId, {
      $set: {
        status: "pending",
        runAt: new Date(Date.now() + backoffMs),
        lastError: error,
        attempts,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async releaseTask(taskId: string): Promise<void> {
    await dbConnect();
    await ScheduledTask.findByIdAndUpdate(taskId, {
      $set: { status: "pending", lockedAt: null, lockedBy: null },
    });
  }

  async cancelTask(taskId: string): Promise<void> {
    await dbConnect();
    await ScheduledTask.findByIdAndUpdate(taskId, {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async getTaskById(taskId: string): Promise<StorageScheduledTask | null> {
    await dbConnect();
    const t = await ScheduledTask.findById(taskId).lean<IScheduledTask>();
    return t ? taskToStorage(t) : null;
  }

  async retryFailedTask(taskId: string): Promise<void> {
    await dbConnect();
    await ScheduledTask.findByIdAndUpdate(taskId, {
      $set: {
        status: "pending",
        runAt: new Date(),
        attempts: 0,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        completedAt: null,
      },
    });
  }

  async bulkCancelPendingTasksForAdmin(filter: {
    adminGroupIds: string[];
    groupId?: string;
    memberEmail?: string;
    type?: StorageScheduledTask["type"];
  }): Promise<number> {
    await dbConnect();
    if (filter.adminGroupIds.length === 0) return 0;
    const visibility = {
      $or: [
        { "payload.groupId": { $in: filter.adminGroupIds } },
        { "payload.payments.groupId": { $in: filter.adminGroupIds } },
      ],
    };
    const and: Record<string, unknown>[] = [visibility];
    if (filter.groupId) {
      and.push({
        $or: [
          { "payload.groupId": filter.groupId },
          { "payload.payments.groupId": filter.groupId },
        ],
      });
    }
    if (filter.memberEmail) {
      const trimmed = filter.memberEmail.trim();
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      and.push({
        "payload.memberEmail": { $regex: new RegExp(`^${escaped}$`, "i") },
      });
    }
    if (filter.type) {
      and.push({ type: filter.type });
    }
    const q = {
      status: { $in: ["pending", "locked"] as const },
      $and: and,
    };
    const result = await ScheduledTask.updateMany(q, {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
    return result.modifiedCount;
  }

  async getTaskCounts(): Promise<{ pending: number; locked: number; completed: number; failed: number; cancelled: number }> {
    await dbConnect();
    const [pending, locked, completed, failed, cancelled] = await Promise.all([
      ScheduledTask.countDocuments({ status: "pending" }),
      ScheduledTask.countDocuments({ status: "locked" }),
      ScheduledTask.countDocuments({ status: "completed" }),
      ScheduledTask.countDocuments({ status: "failed" }),
      ScheduledTask.countDocuments({ status: "cancelled" }),
    ]);
    return { pending, locked, completed, failed, cancelled };
  }

  async listTasks(options: {
    status?: StorageScheduledTask["status"];
    type?: StorageScheduledTask["type"];
    groupId?: string;
    anyGroupIdIn?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<{ tasks: StorageScheduledTask[]; total: number }> {
    await dbConnect();
    const query: Record<string, unknown> = {};
    if (options.status) query.status = options.status;
    if (options.type) query.type = options.type;
    if (options.groupId) query["payload.groupId"] = options.groupId;
    if (options.anyGroupIdIn?.length) {
      query.$or = [
        { "payload.groupId": { $in: options.anyGroupIdIn } },
        { "payload.payments.groupId": { $in: options.anyGroupIdIn } },
      ];
    }
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const [tasks, total] = await Promise.all([
      ScheduledTask.find(query).sort({ runAt: -1 }).skip(offset).limit(limit).lean<IScheduledTask[]>(),
      ScheduledTask.countDocuments(query),
    ]);
    return { tasks: tasks.map(taskToStorage), total };
  }

  // ── price history ──────────────────────────────────────────────────────────

  async createPriceHistory(data: CreatePriceHistoryInput): Promise<StoragePriceHistory> {
    await dbConnect();
    const p = await PriceHistory.create({
      group: new Types.ObjectId(data.groupId),
      price: data.price,
      previousPrice: data.previousPrice,
      currency: data.currency,
      effectiveFrom: data.effectiveFrom,
      note: data.note ?? null,
      membersNotified: data.membersNotified ?? false,
      createdBy: new Types.ObjectId(data.createdBy),
    });
    return priceHistoryToStorage(p);
  }

  async getPriceHistoryForGroup(groupId: string): Promise<StoragePriceHistory[]> {
    await dbConnect();
    const records = await PriceHistory.find({ group: groupId })
      .sort({ effectiveFrom: -1 })
      .lean<IPriceHistory[]>();
    return records.map(priceHistoryToStorage);
  }

  // ── app settings (MongoDB only) ─────────────────────────────────────────────

  private appSettingToStorage(row: ISettings): StorageAppSettingRow {
    return {
      key: row.key,
      value: row.value,
      category: row.category,
      isSecret: row.isSecret,
      label: row.label,
      description: row.description,
    };
  }

  async ensureAppSettingsSeeded(): Promise<void> {
    await dbConnect();
    for (const definition of settingsDefinitions) {
      const existing = await Settings.findOne({ key: definition.key }).lean<ISettings | null>();
      if (existing) continue;
      const envValue = process.env[definition.envVar];
      const value = envValue ?? definition.defaultValue ?? null;
      await Settings.create({
        key: definition.key,
        value,
        category: definition.category,
        isSecret: definition.isSecret,
        label: definition.label,
        description: definition.description,
      });
    }
  }

  async getAppSettingRow(key: string): Promise<StorageAppSettingRow | null> {
    await dbConnect();
    const record = await Settings.findOne({ key }).lean<ISettings | null>();
    return record ? this.appSettingToStorage(record) : null;
  }

  async listAppSettingRows(category?: string): Promise<StorageAppSettingRow[]> {
    await dbConnect();
    const query = category ? { category } : {};
    const records = await Settings.find(query)
      .sort({ category: 1, key: 1 })
      .lean<ISettings[]>();
    return records.map((r) => this.appSettingToStorage(r));
  }

  async upsertAppSettingRow(input: StorageAppSettingRow): Promise<void> {
    await dbConnect();
    await Settings.findOneAndUpdate(
      { key: input.key },
      {
        key: input.key,
        value: input.value,
        category: input.category as ISettings["category"],
        isSecret: input.isSecret,
        label: input.label,
        description: input.description,
      },
      { upsert: true, new: true }
    );
  }

  // ── data portability ───────────────────────────────────────────────────────

  async exportAll(): Promise<ExportBundle> {
    await dbConnect();
    const [groups, billingPeriods, notifications, priceHistory] = await Promise.all([
      Group.find({}).lean<IGroup[]>(),
      BillingPeriod.find({}).lean<IBillingPeriod[]>(),
      Notification.find({}).lean<INotification[]>(),
      PriceHistory.find({}).lean<IPriceHistory[]>(),
    ]);
    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      source: { mode: "advanced", appVersion: process.env.npm_package_version ?? "unknown" },
      data: {
        groups: groups.map(groupToStorage),
        billingPeriods: billingPeriods.map(periodToStorage),
        notifications: notifications.map(notificationToStorage),
        priceHistory: priceHistory.map(priceHistoryToStorage),
      },
    };
  }

  async importAll(bundle: ExportBundle): Promise<ImportResult> {
    await dbConnect();
    const errors: string[] = [];
    let groups = 0;
    let billingPeriods = 0;
    let notifications = 0;
    let priceHistory = 0;

    for (const g of bundle.data.groups) {
      try {
        await Group.findByIdAndUpdate(
          g.id,
          {
            $setOnInsert: {
              _id: g.id,
              name: g.name,
              description: g.description,
              admin: new Types.ObjectId(g.adminId),
              service: g.service,
              billing: g.billing,
              payment: g.payment,
              notifications: g.notifications,
              members: g.members.map((m) => ({
                _id: m.id,
                user: m.userId ? new Types.ObjectId(m.userId) : null,
                email: m.email,
                nickname: m.nickname,
                role: m.role,
                joinedAt: m.joinedAt,
                leftAt: m.leftAt,
                isActive: m.isActive,
                customAmount: m.customAmount,
                acceptedAt: m.acceptedAt,
                unsubscribedFromEmail: m.unsubscribedFromEmail,
                billingStartsAt: m.billingStartsAt,
              })),
              announcements: g.announcements,
              telegramGroup: g.telegramGroup,
              isActive: g.isActive,
              inviteCode: g.inviteCode,
              inviteLinkEnabled: g.inviteLinkEnabled,
              initializedAt: g.initializedAt,
              createdAt: g.createdAt,
            },
          },
          { upsert: true }
        );
        groups++;
      } catch (e) {
        errors.push(`group ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const p of bundle.data.billingPeriods) {
      try {
        await BillingPeriod.findByIdAndUpdate(
          p.id,
          {
            $setOnInsert: {
              _id: p.id,
              group: new Types.ObjectId(p.groupId),
              periodStart: p.periodStart,
              collectionOpensAt: p.collectionOpensAt,
              periodEnd: p.periodEnd,
              periodLabel: p.periodLabel,
              totalPrice: p.totalPrice,
              currency: p.currency,
              priceNote: p.priceNote,
              payments: p.payments.map((pay) => ({
                _id: pay.id,
                memberId: new Types.ObjectId(pay.memberId),
                memberEmail: pay.memberEmail,
                memberNickname: pay.memberNickname,
                amount: pay.amount,
                adjustedAmount: pay.adjustedAmount,
                adjustmentReason: pay.adjustmentReason,
                status: pay.status,
                memberConfirmedAt: pay.memberConfirmedAt,
                adminConfirmedAt: pay.adminConfirmedAt,
                confirmationToken: pay.confirmationToken,
                notes: pay.notes,
              })),
              reminders: p.reminders,
              isFullyPaid: p.isFullyPaid,
              createdAt: p.createdAt,
            },
          },
          { upsert: true }
        );
        billingPeriods++;
      } catch (e) {
        errors.push(`period ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const n of bundle.data.notifications) {
      try {
        await Notification.findByIdAndUpdate(
          n.id,
          {
            $setOnInsert: {
              _id: n.id,
              recipient: n.recipientId ? new Types.ObjectId(n.recipientId) : null,
              recipientEmail: n.recipientEmail,
              group: n.groupId ? new Types.ObjectId(n.groupId) : null,
              billingPeriod: n.billingPeriodId ? new Types.ObjectId(n.billingPeriodId) : null,
              type: n.type,
              channel: n.channel,
              status: n.status,
              subject: n.subject,
              preview: n.preview,
              emailParams: n.emailParams,
              externalId: n.externalId,
              error: n.error,
              deliveredAt: n.deliveredAt,
              createdAt: n.createdAt,
            },
          },
          { upsert: true }
        );
        notifications++;
      } catch (e) {
        errors.push(`notification ${n.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const ph of bundle.data.priceHistory) {
      try {
        await PriceHistory.findByIdAndUpdate(
          ph.id,
          {
            $setOnInsert: {
              _id: ph.id,
              group: new Types.ObjectId(ph.groupId),
              price: ph.price,
              previousPrice: ph.previousPrice,
              currency: ph.currency,
              effectiveFrom: ph.effectiveFrom,
              note: ph.note,
              membersNotified: ph.membersNotified,
              createdBy: new Types.ObjectId(ph.createdBy),
              createdAt: ph.createdAt,
            },
          },
          { upsert: true }
        );
        priceHistory++;
      } catch (e) {
        errors.push(`priceHistory ${ph.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { groups, billingPeriods, notifications, priceHistory, errors };
  }
}
