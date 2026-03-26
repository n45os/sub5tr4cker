import type {
  StorageUser,
  StorageGroup,
  StorageGroupWithUsers,
  StorageBillingPeriod,
  StorageNotification,
  StorageScheduledTask,
  StoragePriceHistory,
  CreateGroupInput,
  UpdateGroupInput,
  CreateBillingPeriodInput,
  UpdateBillingPeriodInput,
  PaymentStatusUpdate,
  CreateNotificationInput,
  CreateTaskInput,
  CreatePriceHistoryInput,
  OpenPeriodsFilter,
  ExportBundle,
  ImportResult,
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

  /** soft delete — sets isActive to false */
  softDeleteGroup(id: string): Promise<void>;

  /** find a group by its invite code; returns null if not found */
  findGroupByInviteCode(code: string): Promise<StorageGroup | null>;

  // ── billing periods ────────────────────────────────────────────────────────

  createBillingPeriod(data: CreateBillingPeriodInput): Promise<StorageBillingPeriod>;

  /** get a period by id scoped to a group; returns null if not found */
  getBillingPeriod(id: string, groupId: string): Promise<StorageBillingPeriod | null>;

  /** get a period by group + periodStart; returns null if not found */
  getBillingPeriodByStart(groupId: string, periodStart: Date): Promise<StorageBillingPeriod | null>;

  /**
   * list open billing periods (collection has started, not fully paid).
   * implements the equivalent of collectionWindowOpenFilter from collection-window.ts.
   */
  getOpenBillingPeriods(filter: OpenPeriodsFilter): Promise<StorageBillingPeriod[]>;

  /** list all periods for a group, ordered by periodStart descending */
  getPeriodsForGroup(groupId: string): Promise<StorageBillingPeriod[]>;

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
    limit?: number;
    offset?: number;
  }): Promise<{ tasks: StorageScheduledTask[]; total: number }>;

  // ── price history ──────────────────────────────────────────────────────────

  createPriceHistory(data: CreatePriceHistoryInput): Promise<StoragePriceHistory>;

  getPriceHistoryForGroup(groupId: string): Promise<StoragePriceHistory[]>;

  // ── data portability ───────────────────────────────────────────────────────

  exportAll(): Promise<ExportBundle>;

  importAll(bundle: ExportBundle): Promise<ImportResult>;
}
