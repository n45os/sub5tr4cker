import type {
  StorageUser,
  StorageGroup,
  StorageGroupWithUsers,
  StorageBillingPeriod,
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

export interface StorageAdapter {
  // ── lifecycle ──────────────────────────────────────────────────────────────

  initialize(): Promise<void>;
  close(): Promise<void>;

  // ── users ──────────────────────────────────────────────────────────────────

  /** get a user by id; returns null if not found */
  getUser(id: string): Promise<StorageUser | null>;

  /** get a user by email (case-insensitive); returns null if not found */
  getUserByEmail(email: string): Promise<StorageUser | null>;

  /** get a user by telegram chatId; returns null if not found */
  getUserByTelegramChatId(chatId: number): Promise<StorageUser | null>;

  /** update specific user fields */
  updateUser(id: string, data: Partial<Omit<StorageUser, "id" | "createdAt">>): Promise<StorageUser>;

  createUser(data: CreateUserInput): Promise<StorageUser>;

  countUsers(): Promise<number>;

  /** count users with role admin (instance bootstrap) */
  getAdminUserCount(): Promise<number>;

  /** set role=admin on the oldest user row; no-op if no users */
  promoteOldestUserToAdmin(): Promise<void>;

  /**
   * atomically link telegram when link code is valid; clears code on success.
   * returns updated user or null when code is invalid/expired.
   */
  linkTelegramAccountWithLinkCode(params: {
    code: string;
    chatId: number;
    username: string | null;
    now: Date;
  }): Promise<StorageUser | null>;

  /**
   * set welcomeEmailSentAt once (first-claim wins). returns true if this call set it.
   */
  tryClaimWelcomeEmailSentAt(userId: string, at: Date): Promise<boolean>;

  // ── groups ─────────────────────────────────────────────────────────────────

  createGroup(data: CreateGroupInput): Promise<StorageGroup>;

  /** get group by id; returns null if not found */
  getGroup(id: string): Promise<StorageGroup | null>;

  /**
   * get group by id with member user records resolved into memberUsers map.
   * used for notification targeting where we need telegram chatIds and prefs.
   */
  getGroupWithMemberUsers(id: string): Promise<StorageGroupWithUsers | null>;

  /**
   * list all active groups where the given userId is admin or a member,
   * or where memberEmail matches an active member.
   */
  listGroupsForUser(userId: string, email: string): Promise<StorageGroup[]>;

  updateGroup(id: string, data: UpdateGroupInput): Promise<StorageGroup>;

  /** all active groups (cron: period creation) */
  listAllActiveGroups(): Promise<StorageGroup[]>;

  /** soft delete — sets isActive to false */
  softDeleteGroup(id: string): Promise<void>;

  /** find a group by its invite code; returns null if not found */
  findGroupByInviteCode(code: string): Promise<StorageGroup | null>;

  /**
   * active group containing the member (telegram invite deep link).
   * when groupId is set, scope lookup to that group only.
   */
  findActiveGroupForMemberInvitation(params: {
    groupId?: string | null;
    memberId: string;
  }): Promise<StorageGroup | null>;

  // ── billing periods ────────────────────────────────────────────────────────

  createBillingPeriod(data: CreateBillingPeriodInput): Promise<StorageBillingPeriod>;

  /** get a period by id scoped to a group; returns null if not found */
  getBillingPeriod(id: string, groupId: string): Promise<StorageBillingPeriod | null>;

  /** get a period by group + periodStart; returns null if not found */
  getBillingPeriodByStart(groupId: string, periodStart: Date): Promise<StorageBillingPeriod | null>;

  /** get a period by id only (callback handlers, token flows) */
  getBillingPeriodById(id: string): Promise<StorageBillingPeriod | null>;

  /**
   * list open billing periods (collection has started, not fully paid).
   * implements the equivalent of collectionWindowOpenFilter from collection-window.ts.
   */
  getOpenBillingPeriods(filter: OpenPeriodsFilter): Promise<StorageBillingPeriod[]>;

  /** list all periods for a group, ordered by periodStart descending */
  getPeriodsForGroup(groupId: string): Promise<StorageBillingPeriod[]>;

  /** unpaid periods with periodStart strictly before asOf (cron: mark overdue) */
  listUnpaidPeriodsWithStartBefore(asOf: Date): Promise<StorageBillingPeriod[]>;

  /** list future periods (periodStart > now) for a group */
  getFuturePeriods(groupId: string, afterDate: Date): Promise<StorageBillingPeriod[]>;

  updateBillingPeriod(id: string, data: UpdateBillingPeriodInput): Promise<StorageBillingPeriod>;

  deleteBillingPeriod(id: string, groupId: string): Promise<void>;

  // ── payments (embedded in billing periods) ─────────────────────────────────

  /**
   * update specific fields on a single payment within a billing period.
   * recalculates isFullyPaid after applying the update.
   */
  updatePaymentStatus(
    periodId: string,
    memberId: string,
    update: PaymentStatusUpdate
  ): Promise<StorageBillingPeriod>;

  /**
   * find a billing period by confirmation token embedded on a payment.
   * returns the period and the matching payment index.
   */
  getBillingPeriodByConfirmationToken(
    token: string
  ): Promise<{ period: StorageBillingPeriod; paymentIndex: number } | null>;

  // ── notifications ──────────────────────────────────────────────────────────

  logNotification(data: CreateNotificationInput): Promise<StorageNotification>;

  /** get recent notifications for a group, newest first */
  getNotificationsForGroup(
    groupId: string,
    limit?: number
  ): Promise<StorageNotification[]>;

  getNotificationById(id: string): Promise<StorageNotification | null>;

  listNotifications(options: {
    groupIds: string[];
    type?: StorageNotificationType;
    channel?: "email" | "telegram";
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: StorageNotification[]; total: number }>;

  // ── audit ──────────────────────────────────────────────────────────────────

  logAudit(data: CreateAuditEventInput): Promise<StorageAuditEvent>;

  listAuditEvents(options?: {
    groupIds?: string[];
    limit?: number;
    offset?: number;
    /** when true, return every matching row (activity feed merge) */
    unbounded?: boolean;
  }): Promise<{ events: StorageAuditEvent[]; total: number }>;

  // ── scheduled tasks ────────────────────────────────────────────────────────

  /**
   * enqueue a task; no-ops (returns null) if a task with the same
   * idempotencyKey already exists.
   */
  enqueueTask(data: CreateTaskInput): Promise<StorageScheduledTask | null>;

  /**
   * claim up to limit due pending tasks, optionally recovering stale locks.
   * uses optimistic locking to prevent double-claiming.
   */
  claimTasks(
    workerId: string,
    options?: {
      limit?: number;
      lockTtlMs?: number;
      recoverStaleLocks?: boolean;
    }
  ): Promise<StorageScheduledTask[]>;

  completeTask(taskId: string): Promise<void>;

  failTask(taskId: string, error: string, attempts: number, maxAttempts: number): Promise<void>;

  releaseTask(taskId: string): Promise<void>;

  cancelTask(taskId: string): Promise<void>;

  getTaskById(taskId: string): Promise<StorageScheduledTask | null>;

  /** reset a failed task to pending for immediate retry */
  retryFailedTask(taskId: string): Promise<void>;

  /**
   * cancel pending/locked tasks visible to these admin groups, with optional refinements
   * (same semantics as POST /api/scheduled-tasks/bulk-cancel)
   */
  bulkCancelPendingTasksForAdmin(filter: {
    adminGroupIds: string[];
    groupId?: string;
    memberEmail?: string;
    type?: StorageScheduledTask["type"];
  }): Promise<number>;

  getTaskCounts(): Promise<{
    pending: number;
    locked: number;
    completed: number;
    failed: number;
    cancelled: number;
  }>;

  /** list tasks with optional filters; used by the admin scheduled-tasks UI */
  listTasks(options?: {
    status?: StorageScheduledTask["status"];
    type?: StorageScheduledTask["type"];
    groupId?: string;
    /** tasks whose payload references any of these group ids (admin queue) */
    anyGroupIdIn?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ tasks: StorageScheduledTask[]; total: number }>;

  // ── price history ──────────────────────────────────────────────────────────

  createPriceHistory(data: CreatePriceHistoryInput): Promise<StoragePriceHistory>;

  getPriceHistoryForGroup(groupId: string): Promise<StoragePriceHistory[]>;

  // ── data portability ───────────────────────────────────────────────────────

  exportAll(): Promise<ExportBundle>;

  importAll(bundle: ExportBundle): Promise<ImportResult>;

  // ── app settings (MongoDB advanced mode only; local mode uses config.json) ─

  /** seed defaults from definitions + env (idempotent) */
  ensureAppSettingsSeeded(): Promise<void>;

  getAppSettingRow(key: string): Promise<StorageAppSettingRow | null>;

  listAppSettingRows(category?: string): Promise<StorageAppSettingRow[]>;

  upsertAppSettingRow(input: StorageAppSettingRow): Promise<void>;
}
