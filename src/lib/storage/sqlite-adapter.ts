import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { readConfig } from "@/lib/config/manager";
import { LOCAL_ADMIN_USER_ID } from "@/lib/auth/local";
import type { StorageAdapter } from "./adapter";
import type {
  StorageUser,
  StorageGroup,
  StorageGroupMember,
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

// ── schema ────────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    invite_code TEXT UNIQUE,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_groups_admin ON groups(admin_id);
  CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active);

  CREATE TABLE IF NOT EXISTS billing_periods (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    period_start TEXT NOT NULL,
    collection_opens_at TEXT,
    is_fully_paid INTEGER NOT NULL DEFAULT 0,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_bp_group_start ON billing_periods(group_id, period_start);
  CREATE INDEX IF NOT EXISTS idx_bp_group ON billing_periods(group_id);
  CREATE INDEX IF NOT EXISTS idx_bp_unpaid ON billing_periods(is_fully_paid);

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notif_group ON notifications(group_id);
  CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at);

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    data JSON NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_group ON audit_events(group_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);

  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    run_at TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    locked_at TEXT,
    locked_by TEXT,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status_run ON scheduled_tasks(status, run_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_locked ON scheduled_tasks(locked_at);

  CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ph_group ON price_history(group_id);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    telegram_chat_id INTEGER UNIQUE,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

// same logic as canUserManageTask in admin-access (duplicated to avoid import cycle with db())
function taskVisibleToAdminGroups(
  task: StorageScheduledTask,
  adminGroupIds: Set<string>
): boolean {
  const payload = task.payload;
  if (payload.groupId && adminGroupIds.has(payload.groupId)) return true;
  if (payload.payments?.length) {
    return payload.payments.some((p) => p.groupId && adminGroupIds.has(p.groupId));
  }
  return false;
}

function parseRow<T>(row: { data: string } & Record<string, unknown>): T {
  return JSON.parse(row.data as string) as T;
}

function parseDates<T extends Record<string, unknown>>(obj: T, dateKeys: string[]): T {
  const out = { ...obj };
  for (const key of dateKeys) {
    if (typeof out[key] === "string") {
      (out as Record<string, unknown>)[key] = new Date(out[key] as string);
    } else if (out[key] === null || out[key] === undefined) {
      (out as Record<string, unknown>)[key] = null;
    }
  }
  return out;
}

const GROUP_DATE_KEYS = ["joinedAt", "leftAt", "acceptedAt", "billingStartsAt", "initializedAt", "createdAt", "updatedAt", "linkedAt"];
const PERIOD_DATE_KEYS = ["periodStart", "collectionOpensAt", "periodEnd", "createdAt", "updatedAt", "sentAt", "memberConfirmedAt", "adminConfirmedAt"];
const TASK_DATE_KEYS = ["runAt", "lockedAt", "completedAt", "cancelledAt", "createdAt", "updatedAt"];
const NOTIF_DATE_KEYS = ["deliveredAt", "createdAt"];
const AUDIT_DATE_KEYS = ["createdAt"];
const PH_DATE_KEYS = ["effectiveFrom", "createdAt"];
const USER_DATE_KEYS = ["emailVerified", "welcomeEmailSentAt", "createdAt", "updatedAt", "linkedAt", "expiresAt"];

function hydrateGroup(data: Record<string, unknown>): StorageGroup {
  const g = parseDates(data, ["initializedAt", "createdAt", "updatedAt"]) as unknown as StorageGroup;
  if (Array.isArray(g.members)) {
    g.members = g.members.map((m: StorageGroupMember) =>
      parseDates(m as unknown as Record<string, unknown>, ["joinedAt", "leftAt", "acceptedAt", "billingStartsAt"]) as unknown as StorageGroupMember
    );
  }
  if (g.telegramGroup) {
    g.telegramGroup = parseDates(g.telegramGroup as unknown as Record<string, unknown>, ["linkedAt"]) as unknown as StorageGroup["telegramGroup"];
  }
  return g;
}

function hydratePeriod(data: Record<string, unknown>): StorageBillingPeriod {
  const p = parseDates(data, ["periodStart", "collectionOpensAt", "periodEnd", "createdAt", "updatedAt"]) as unknown as StorageBillingPeriod;
  if (Array.isArray(p.payments)) {
    p.payments = p.payments.map((pay) =>
      parseDates(pay as unknown as Record<string, unknown>, ["memberConfirmedAt", "adminConfirmedAt"]) as unknown as typeof pay
    );
  }
  if (Array.isArray(p.reminders)) {
    p.reminders = p.reminders.map((r) =>
      parseDates(r as unknown as Record<string, unknown>, ["sentAt"]) as unknown as typeof r
    );
  }
  return p;
}

function hydrateTask(data: Record<string, unknown>): StorageScheduledTask {
  return parseDates(data, ["runAt", "lockedAt", "completedAt", "cancelledAt", "createdAt", "updatedAt"]) as unknown as StorageScheduledTask;
}

function hydrateNotification(data: Record<string, unknown>): StorageNotification {
  return parseDates(data, ["deliveredAt", "createdAt"]) as unknown as StorageNotification;
}

function hydrateAuditEvent(data: Record<string, unknown>): StorageAuditEvent {
  return parseDates(data, ["createdAt"]) as unknown as StorageAuditEvent;
}

function hydratePriceHistory(data: Record<string, unknown>): StoragePriceHistory {
  return parseDates(data, ["effectiveFrom", "createdAt"]) as unknown as StoragePriceHistory;
}

function hydrateUser(data: Record<string, unknown>): StorageUser {
  const u = parseDates(data, ["emailVerified", "welcomeEmailSentAt", "createdAt", "updatedAt"]) as unknown as StorageUser;
  if (u.telegram) {
    u.telegram = parseDates(u.telegram as unknown as Record<string, unknown>, ["linkedAt"]) as unknown as StorageUser["telegram"];
  }
  if (u.telegramLinkCode) {
    u.telegramLinkCode = parseDates(u.telegramLinkCode as unknown as Record<string, unknown>, ["expiresAt"]) as unknown as StorageUser["telegramLinkCode"];
  }
  return u;
}

// suppress unused warning for unused date key arrays (kept for reference)
void GROUP_DATE_KEYS;
void PERIOD_DATE_KEYS;
void TASK_DATE_KEYS;
void NOTIF_DATE_KEYS;
void AUDIT_DATE_KEYS;
void PH_DATE_KEYS;
void USER_DATE_KEYS;

const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;

// ── adapter ───────────────────────────────────────────────────────────────────

export class SqliteAdapter implements StorageAdapter {
  private db!: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    if (this.db) return;

    const fs = await import("fs");
    const path = await import("path");
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA_SQL);
    this.seedLocalAdmin();
  }

  // ensure the local admin user row exists (reads email/name from config)
  private seedLocalAdmin(): void {
    try {
      const config = readConfig();
      if (!config) return;

      const existing = this.db
        .prepare("SELECT id FROM users WHERE id = ?")
        .get(LOCAL_ADMIN_USER_ID) as { id: string } | undefined;

      const ts = new Date();
      const user: StorageUser = {
        id: LOCAL_ADMIN_USER_ID,
        name: config.adminName ?? "Admin",
        email: config.adminEmail ?? "admin@localhost",
        role: "admin",
        emailVerified: null,
        image: null,
        hashedPassword: null,
        telegram: null,
        telegramLinkCode: null,
        notificationPreferences: {
          email: !!config.notifications?.channels?.email,
          telegram: !!config.notifications?.channels?.telegram,
          reminderFrequency: "once",
        },
        welcomeEmailSentAt: null,
        createdAt: existing ? ts : ts,
        updatedAt: ts,
      };
      this.upsertUser(user);
    } catch {
      // config not available yet (e.g. during init) — skip silently
    }
  }

  async close(): Promise<void> {
    this.db?.close();
    // clear the reference so future initialize() calls can reopen it
    // if the adapter is reused after close
    this.db = undefined as never;
  }

  private ensureOpen(): void {
    if (!this.db) throw new Error("SqliteAdapter not initialized — call initialize() first");
  }

  // ── users ──────────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<StorageUser | null> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM users WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) return null;
    return hydrateUser(parseRow(row));
  }

  async getUserByEmail(email: string): Promise<StorageUser | null> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM users WHERE email = ?").get(email.toLowerCase().trim()) as { data: string } | undefined;
    if (!row) return null;
    return hydrateUser(parseRow(row));
  }

  async getUserByTelegramChatId(chatId: number): Promise<StorageUser | null> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM users WHERE telegram_chat_id = ?").get(chatId) as { data: string } | undefined;
    if (!row) return null;
    return hydrateUser(parseRow(row));
  }

  async updateUser(id: string, data: Partial<Omit<StorageUser, "id" | "createdAt">>): Promise<StorageUser> {
    this.ensureOpen();
    const existing = await this.getUser(id);
    if (!existing) throw new Error(`user not found: ${id}`);
    const merged: StorageUser = { ...existing, ...data, updatedAt: new Date() };
    this.db.prepare(
      "UPDATE users SET email = ?, telegram_chat_id = ?, data = ?, updated_at = ? WHERE id = ?"
    ).run(
      merged.email.toLowerCase(),
      merged.telegram?.chatId ?? null,
      JSON.stringify(merged),
      now(),
      id
    );
    return merged;
  }

  async createUser(data: CreateUserInput): Promise<StorageUser> {
    this.ensureOpen();
    const id = nanoid();
    const ts = now();
    const user: StorageUser = {
      id,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      role: data.role,
      emailVerified: null,
      image: null,
      hashedPassword: data.hashedPassword,
      telegram: null,
      telegramLinkCode: null,
      notificationPreferences: data.notificationPreferences,
      welcomeEmailSentAt: null,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    };
    this.db.prepare(`
      INSERT INTO users (id, email, telegram_chat_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, user.email, null, JSON.stringify(user), ts, ts);
    return user;
  }

  async countUsers(): Promise<number> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
    return row.c;
  }

  async getAdminUserCount(): Promise<number> {
    this.ensureOpen();
    const rows = this.db.prepare("SELECT data FROM users").all() as { data: string }[];
    return rows.filter((r) => (hydrateUser(parseRow(r)) as StorageUser).role === "admin").length;
  }

  async promoteOldestUserToAdmin(): Promise<void> {
    this.ensureOpen();
    const row = this.db.prepare(
      "SELECT id, data FROM users ORDER BY created_at ASC LIMIT 1"
    ).get() as { id: string; data: string } | undefined;
    if (!row) return;
    const u = hydrateUser(parseRow(row));
    if (u.role === "admin") return;
    await this.updateUser(u.id, { role: "admin" });
  }

  async linkTelegramAccountWithLinkCode(params: {
    code: string;
    chatId: number;
    username: string | null;
    now: Date;
  }): Promise<StorageUser | null> {
    this.ensureOpen();
    const { code, chatId, username, now } = params;
    const row = this.db
      .prepare(
        "SELECT id, data FROM users WHERE json_extract(data, '$.telegramLinkCode.code') = ?"
      )
      .get(code) as { id: string; data: string } | undefined;
    if (!row) return null;
    const u = hydrateUser(parseRow(row));
    if (
      !u.telegramLinkCode ||
      u.telegramLinkCode.code !== code ||
      u.telegramLinkCode.expiresAt <= now
    ) {
      return null;
    }
    return await this.updateUser(u.id, {
      telegram: { chatId, username, linkedAt: now },
      telegramLinkCode: null,
      notificationPreferences: { ...u.notificationPreferences, telegram: true },
    });
  }

  async tryClaimWelcomeEmailSentAt(userId: string, at: Date): Promise<boolean> {
    this.ensureOpen();
    const u = await this.getUser(userId);
    if (!u || u.welcomeEmailSentAt) return false;
    await this.updateUser(userId, { welcomeEmailSentAt: at });
    return true;
  }

  // local mode: upsert the single admin user
  upsertUser(user: StorageUser): void {
    this.ensureOpen();
    this.db.prepare(`
      INSERT INTO users (id, email, telegram_chat_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        telegram_chat_id = excluded.telegram_chat_id,
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(
      user.id,
      user.email.toLowerCase(),
      user.telegram?.chatId ?? null,
      JSON.stringify(user),
      user.createdAt.toISOString(),
      now()
    );
  }

  // ── groups ─────────────────────────────────────────────────────────────────

  async createGroup(data: CreateGroupInput): Promise<StorageGroup> {
    this.ensureOpen();
    const id = nanoid();
    const ts = now();
    const group: StorageGroup = {
      id,
      ...data,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    };
    this.db.prepare(`
      INSERT INTO groups (id, admin_id, is_active, invite_code, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.adminId, data.isActive ? 1 : 0, data.inviteCode ?? null, JSON.stringify(group), ts, ts);
    return group;
  }

  async getGroup(id: string): Promise<StorageGroup | null> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM groups WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) return null;
    return hydrateGroup(parseRow(row));
  }

  async getGroupWithMemberUsers(id: string): Promise<StorageGroupWithUsers | null> {
    this.ensureOpen();
    const group = await this.getGroup(id);
    if (!group) return null;

    // in local mode there is a single admin user; populate what we can from the users table
    const memberUsers = new Map<string, Pick<StorageUser, "telegram" | "notificationPreferences"> | null>();
    for (const member of group.members) {
      if (member.userId) {
        const user = await this.getUser(member.userId);
        if (user) {
          memberUsers.set(member.id, {
            telegram: user.telegram,
            notificationPreferences: user.notificationPreferences,
          });
          continue;
        }
      }
      memberUsers.set(member.id, null);
    }
    return { ...group, memberUsers };
  }

  async listGroupsForUser(userId: string, email: string): Promise<StorageGroup[]> {
    this.ensureOpen();
    // fetch all active groups and filter in JS (SQLite JSON functions are available but
    // querying embedded arrays is verbose; at local scale this is fine)
    const rows = this.db.prepare("SELECT data FROM groups WHERE is_active = 1").all() as { data: string }[];
    const groups: StorageGroup[] = rows.map((r) => hydrateGroup(parseRow(r)));
    return groups.filter((g) => {
      if (g.adminId === userId) return true;
      return g.members.some(
        (m) =>
          m.isActive &&
          (m.userId === userId ||
            (!!m.email && m.email.toLowerCase() === email.toLowerCase()))
      );
    });
  }

  async listAllActiveGroups(): Promise<StorageGroup[]> {
    this.ensureOpen();
    const rows = this.db.prepare("SELECT data FROM groups WHERE is_active = 1").all() as { data: string }[];
    return rows.map((r) => hydrateGroup(parseRow(r)));
  }

  async updateGroup(id: string, data: UpdateGroupInput): Promise<StorageGroup> {
    this.ensureOpen();
    const existing = await this.getGroup(id);
    if (!existing) throw new Error(`group not found: ${id}`);
    const merged: StorageGroup = { ...existing, ...data, updatedAt: new Date() };
    const ts = now();
    this.db.prepare(`
      UPDATE groups SET admin_id = ?, is_active = ?, invite_code = ?, data = ?, updated_at = ?
      WHERE id = ?
    `).run(merged.adminId, merged.isActive ? 1 : 0, merged.inviteCode ?? null, JSON.stringify(merged), ts, id);
    return merged;
  }

  async softDeleteGroup(id: string): Promise<void> {
    this.ensureOpen();
    const existing = await this.getGroup(id);
    if (!existing) return;
    await this.updateGroup(id, { isActive: false });
  }

  async findGroupByInviteCode(code: string): Promise<StorageGroup | null> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM groups WHERE invite_code = ?").get(code) as { data: string } | undefined;
    if (!row) return null;
    return hydrateGroup(parseRow(row));
  }

  async findActiveGroupForMemberInvitation(params: {
    groupId?: string | null;
    memberId: string;
  }): Promise<StorageGroup | null> {
    this.ensureOpen();
    const { groupId, memberId } = params;
    if (groupId) {
      const g = await this.getGroup(groupId);
      if (!g?.isActive) return null;
      const m = g.members.find(
        (mm) => mm.id === memberId && mm.isActive && !mm.leftAt
      );
      return m ? g : null;
    }
    const rows = this.db.prepare("SELECT data FROM groups WHERE is_active = 1").all() as {
      data: string;
    }[];
    for (const row of rows) {
      const g = hydrateGroup(parseRow(row));
      const m = g.members.find(
        (mm) => mm.id === memberId && mm.isActive && !mm.leftAt
      );
      if (m) return g;
    }
    return null;
  }

  // ── billing periods ────────────────────────────────────────────────────────

  async createBillingPeriod(data: CreateBillingPeriodInput): Promise<StorageBillingPeriod> {
    this.ensureOpen();
    const id = nanoid();
    const ts = now();
    const period: StorageBillingPeriod = {
      id,
      ...data,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    };
    this.db.prepare(`
      INSERT INTO billing_periods (id, group_id, period_start, collection_opens_at, is_fully_paid, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.groupId,
      data.periodStart.toISOString(),
      data.collectionOpensAt?.toISOString() ?? null,
      data.isFullyPaid ? 1 : 0,
      JSON.stringify(period),
      ts,
      ts
    );
    return period;
  }

  async getBillingPeriod(id: string, groupId: string): Promise<StorageBillingPeriod | null> {
    this.ensureOpen();
    const row = this.db.prepare(
      "SELECT data FROM billing_periods WHERE id = ? AND group_id = ?"
    ).get(id, groupId) as { data: string } | undefined;
    if (!row) return null;
    return hydratePeriod(parseRow(row));
  }

  async getBillingPeriodByStart(groupId: string, periodStart: Date): Promise<StorageBillingPeriod | null> {
    this.ensureOpen();
    const row = this.db.prepare(
      "SELECT data FROM billing_periods WHERE group_id = ? AND period_start = ?"
    ).get(groupId, periodStart.toISOString()) as { data: string } | undefined;
    if (!row) return null;
    return hydratePeriod(parseRow(row));
  }

  async getBillingPeriodById(id: string): Promise<StorageBillingPeriod | null> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM billing_periods WHERE id = ?").get(id) as
      | { data: string }
      | undefined;
    if (!row) return null;
    return hydratePeriod(parseRow(row));
  }

  async getOpenBillingPeriods(filter: OpenPeriodsFilter): Promise<StorageBillingPeriod[]> {
    this.ensureOpen();
    const asOf = filter.asOf.toISOString();
    // equivalent to MongoDB's collectionWindowOpenFilter:
    // COALESCE(collection_opens_at, period_start) <= asOf
    let sql = `
      SELECT data FROM billing_periods
      WHERE COALESCE(collection_opens_at, period_start) <= ?
    `;
    const params: (string | number)[] = [asOf];

    if (filter.unpaidOnly) {
      sql += " AND is_fully_paid = 0";
    }
    if (filter.groupIds && filter.groupIds.length > 0) {
      sql += ` AND group_id IN (${filter.groupIds.map(() => "?").join(",")})`;
      params.push(...filter.groupIds);
    }

    const rows = this.db.prepare(sql).all(...params) as { data: string }[];
    return rows.map((r) => hydratePeriod(parseRow(r)));
  }

  async getPeriodsForGroup(groupId: string): Promise<StorageBillingPeriod[]> {
    this.ensureOpen();
    const rows = this.db.prepare(
      "SELECT data FROM billing_periods WHERE group_id = ? ORDER BY period_start DESC"
    ).all(groupId) as { data: string }[];
    return rows.map((r) => hydratePeriod(parseRow(r)));
  }

  async listUnpaidPeriodsWithStartBefore(asOf: Date): Promise<StorageBillingPeriod[]> {
    this.ensureOpen();
    const rows = this.db.prepare(`
      SELECT data FROM billing_periods
      WHERE is_fully_paid = 0 AND period_start < ?
    `).all(asOf.toISOString()) as { data: string }[];
    return rows.map((r) => hydratePeriod(parseRow(r)));
  }

  async getFuturePeriods(groupId: string, afterDate: Date): Promise<StorageBillingPeriod[]> {
    this.ensureOpen();
    const rows = this.db.prepare(
      "SELECT data FROM billing_periods WHERE group_id = ? AND period_start > ? ORDER BY period_start ASC"
    ).all(groupId, afterDate.toISOString()) as { data: string }[];
    return rows.map((r) => hydratePeriod(parseRow(r)));
  }

  async updateBillingPeriod(id: string, data: UpdateBillingPeriodInput): Promise<StorageBillingPeriod> {
    this.ensureOpen();
    const existing = await this.db.prepare(
      "SELECT data, group_id FROM billing_periods WHERE id = ?"
    ).get(id) as { data: string; group_id: string } | undefined;
    if (!existing) throw new Error(`billing period not found: ${id}`);
    const current = hydratePeriod(parseRow(existing));
    const merged: StorageBillingPeriod = { ...current, ...data, updatedAt: new Date() };
    const ts = now();
    this.db.prepare(`
      UPDATE billing_periods
      SET collection_opens_at = ?, is_fully_paid = ?, data = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.collectionOpensAt?.toISOString() ?? null,
      merged.isFullyPaid ? 1 : 0,
      JSON.stringify(merged),
      ts,
      id
    );
    return merged;
  }

  async deleteBillingPeriod(id: string, groupId: string): Promise<void> {
    this.ensureOpen();
    this.db.prepare("DELETE FROM billing_periods WHERE id = ? AND group_id = ?").run(id, groupId);
  }

  async updatePaymentStatus(
    periodId: string,
    memberId: string,
    update: PaymentStatusUpdate
  ): Promise<StorageBillingPeriod> {
    this.ensureOpen();
    const row = this.db.prepare(
      "SELECT data, group_id FROM billing_periods WHERE id = ?"
    ).get(periodId) as { data: string; group_id: string } | undefined;
    if (!row) throw new Error(`billing period not found: ${periodId}`);
    const period = hydratePeriod(parseRow(row));
    const payment = period.payments.find((p) => p.memberId === memberId);
    if (!payment) throw new Error(`payment not found for member ${memberId} in period ${periodId}`);
    if (update.status !== undefined) payment.status = update.status;
    if (update.memberConfirmedAt !== undefined) payment.memberConfirmedAt = update.memberConfirmedAt;
    if (update.adminConfirmedAt !== undefined) payment.adminConfirmedAt = update.adminConfirmedAt;
    if (update.confirmationToken !== undefined) payment.confirmationToken = update.confirmationToken;
    if (update.notes !== undefined) payment.notes = update.notes;
    if (update.adjustedAmount !== undefined) payment.adjustedAmount = update.adjustedAmount;
    if (update.adjustmentReason !== undefined) payment.adjustmentReason = update.adjustmentReason;
    period.isFullyPaid = period.payments.every(
      (p) => p.status === "confirmed" || p.status === "waived"
    );
    period.updatedAt = new Date();
    const ts = now();
    this.db.prepare(`
      UPDATE billing_periods SET is_fully_paid = ?, data = ?, updated_at = ? WHERE id = ?
    `).run(period.isFullyPaid ? 1 : 0, JSON.stringify(period), ts, periodId);
    return period;
  }

  async getBillingPeriodByConfirmationToken(
    token: string
  ): Promise<{ period: StorageBillingPeriod; paymentIndex: number } | null> {
    this.ensureOpen();
    // scan all periods for a matching confirmation token (rare operation)
    const rows = this.db.prepare("SELECT data FROM billing_periods").all() as { data: string }[];
    for (const r of rows) {
      const period = hydratePeriod(parseRow(r));
      const idx = period.payments.findIndex((p) => p.confirmationToken === token);
      if (idx !== -1) return { period, paymentIndex: idx };
    }
    return null;
  }

  // ── notifications ──────────────────────────────────────────────────────────

  async logNotification(data: CreateNotificationInput): Promise<StorageNotification> {
    this.ensureOpen();
    const id = nanoid();
    const ts = now();
    const notif: StorageNotification = {
      id,
      recipientId: data.recipientId ?? null,
      recipientEmail: data.recipientEmail ?? null,
      recipientLabel: data.recipientLabel,
      groupId: data.groupId ?? null,
      billingPeriodId: data.billingPeriodId ?? null,
      type: data.type,
      channel: data.channel,
      status: data.status,
      subject: data.subject ?? null,
      preview: data.preview,
      emailParams: data.emailParams ?? null,
      externalId: data.externalId ?? null,
      error: data.error ?? null,
      deliveredAt: data.deliveredAt ?? null,
      createdAt: new Date(ts),
    };
    this.db.prepare(`
      INSERT INTO notifications (id, group_id, data, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, data.groupId ?? null, JSON.stringify(notif), ts);
    return notif;
  }

  async getNotificationsForGroup(groupId: string, limit = 50): Promise<StorageNotification[]> {
    this.ensureOpen();
    const rows = this.db.prepare(
      "SELECT data FROM notifications WHERE group_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(groupId, limit) as { data: string }[];
    return rows.map((r) => hydrateNotification(parseRow(r)));
  }

  async getNotificationById(id: string): Promise<StorageNotification | null> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM notifications WHERE id = ?").get(id) as
      | { data: string }
      | undefined;
    if (!row) return null;
    return hydrateNotification(parseRow(row));
  }

  async listNotifications(options: {
    groupIds: string[];
    type?: StorageNotificationType;
    channel?: "email" | "telegram";
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: StorageNotification[]; total: number }> {
    this.ensureOpen();
    const { groupIds, type, channel, limit, offset } = options;
    if (!groupIds.length) {
      return { notifications: [], total: 0 };
    }

    const inList = groupIds.map(() => "?").join(", ");
    let sqlWhere = `WHERE group_id IN (${inList})`;
    const params: (string | number)[] = [...groupIds];

    if (type) {
      sqlWhere += ` AND json_extract(data, '$.type') = ?`;
      params.push(type);
    }
    if (channel) {
      sqlWhere += ` AND json_extract(data, '$.channel') = ?`;
      params.push(channel);
    }

    const totalRow = this.db.prepare(`SELECT COUNT(*) as total FROM notifications ${sqlWhere}`).get(...params) as {
      total: number;
    };

    let sql = `SELECT data FROM notifications ${sqlWhere} ORDER BY created_at DESC`;
    const listParams: (string | number)[] = [...params];
    if (limit !== undefined) {
      sql += " LIMIT ?";
      listParams.push(limit);
      if (offset !== undefined) {
        sql += " OFFSET ?";
        listParams.push(offset);
      }
    } else if (offset !== undefined) {
      sql += " LIMIT -1 OFFSET ?";
      listParams.push(offset);
    }

    const rows = this.db.prepare(sql).all(...listParams) as { data: string }[];
    return {
      total: totalRow.total,
      notifications: rows.map((r) => hydrateNotification(parseRow(r))),
    };
  }

  async logAudit(data: CreateAuditEventInput): Promise<StorageAuditEvent> {
    this.ensureOpen();
    const id = nanoid();
    const ts = now();
    const event: StorageAuditEvent = {
      id,
      actorId: data.actorId,
      actorName: data.actorName,
      action: data.action,
      groupId: data.groupId ?? null,
      billingPeriodId: data.billingPeriodId ?? null,
      targetMemberId: data.targetMemberId ?? null,
      metadata: data.metadata ?? {},
      createdAt: new Date(ts),
    };

    this.db.prepare(`
      INSERT INTO audit_events (id, group_id, created_at, data)
      VALUES (?, ?, ?, ?)
    `).run(id, event.groupId, ts, JSON.stringify(event));

    return event;
  }

  async listAuditEvents(options: {
    groupIds?: string[];
    limit?: number;
    offset?: number;
    unbounded?: boolean;
  } = {}): Promise<{ events: StorageAuditEvent[]; total: number }> {
    this.ensureOpen();

    const unbounded = options.unbounded === true;
    const limit = unbounded ? undefined : (options.limit ?? 50);
    const offset = unbounded ? undefined : (options.offset ?? 0);
    const groupIds = options.groupIds ?? [];

    const where = groupIds.length
      ? `WHERE group_id IN (${groupIds.map(() => "?").join(", ")})`
      : "";

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) as total FROM audit_events ${where}`)
      .get(...groupIds) as { total: number };

    let listSql = `SELECT data FROM audit_events ${where} ORDER BY created_at DESC`;
    const listParams: (string | number)[] = [...groupIds];
    if (limit !== undefined) {
      listSql += " LIMIT ?";
      listParams.push(limit);
      if (offset !== undefined) {
        listSql += " OFFSET ?";
        listParams.push(offset);
      }
    } else if (offset !== undefined) {
      listSql += " LIMIT -1 OFFSET ?";
      listParams.push(offset);
    }

    const rows = this.db.prepare(listSql).all(...listParams) as { data: string }[];

    return {
      total: totalRow.total,
      events: rows.map((row) => hydrateAuditEvent(parseRow(row))),
    };
  }

  // ── scheduled tasks ────────────────────────────────────────────────────────

  async enqueueTask(data: CreateTaskInput): Promise<StorageScheduledTask | null> {
    this.ensureOpen();
    const existing = this.db.prepare(
      "SELECT id FROM scheduled_tasks WHERE idempotency_key = ?"
    ).get(data.idempotencyKey);
    if (existing) return null;

    const id = nanoid();
    const ts = now();
    const task: StorageScheduledTask = {
      id,
      type: data.type,
      status: "pending",
      runAt: data.runAt,
      lockedAt: null,
      lockedBy: null,
      attempts: 0,
      maxAttempts: data.maxAttempts ?? 5,
      lastError: null,
      completedAt: null,
      cancelledAt: null,
      idempotencyKey: data.idempotencyKey,
      payload: data.payload,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    };
    this.db.prepare(`
      INSERT INTO scheduled_tasks (id, type, status, run_at, idempotency_key, locked_at, locked_by, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.type, "pending", data.runAt.toISOString(), data.idempotencyKey, null, null, JSON.stringify(task), ts, ts);
    return task;
  }

  async claimTasks(
    workerId: string,
    options: { limit?: number; lockTtlMs?: number; recoverStaleLocks?: boolean } = {}
  ): Promise<StorageScheduledTask[]> {
    this.ensureOpen();
    const limit = options.limit ?? 50;
    const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
    const nowTs = now();
    const staleThreshold = new Date(Date.now() - lockTtlMs).toISOString();

    if (options.recoverStaleLocks) {
      // update JSON data for all stale locked tasks
      const stale = this.db.prepare(
        "SELECT id, data FROM scheduled_tasks WHERE status = 'locked' AND locked_at < ?"
      ).all(staleThreshold) as { id: string; data: string }[];
      const releaseStmt = this.db.prepare(
        "UPDATE scheduled_tasks SET status = 'pending', locked_at = NULL, locked_by = NULL, data = ?, updated_at = ? WHERE id = ?"
      );
      for (const s of stale) {
        const t = hydrateTask(parseRow(s));
        t.status = "pending";
        t.lockedAt = null;
        t.lockedBy = null;
        t.updatedAt = new Date();
        releaseStmt.run(JSON.stringify(t), nowTs, s.id);
      }
    }

    // claim tasks: fetch candidates then update each atomically
    const candidates = this.db.prepare(`
      SELECT id, data FROM scheduled_tasks
      WHERE status = 'pending' AND run_at <= ?
      ORDER BY run_at ASC
      LIMIT ?
    `).all(nowTs, limit) as { id: string; data: string }[];

    const claimed: StorageScheduledTask[] = [];
    const claimStmt = this.db.prepare(`
      UPDATE scheduled_tasks
      SET status = 'locked', locked_at = ?, locked_by = ?, data = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `);
    for (const c of candidates) {
      const t = hydrateTask(parseRow(c));
      t.status = "locked";
      t.lockedAt = new Date(nowTs);
      t.lockedBy = workerId;
      t.updatedAt = new Date();
      const result = claimStmt.run(nowTs, workerId, JSON.stringify(t), nowTs, c.id) as Database.RunResult;
      if (result.changes > 0) claimed.push(t);
    }
    return claimed;
  }

  async completeTask(taskId: string): Promise<void> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId) as { data: string } | undefined;
    if (!row) return;
    const t = hydrateTask(parseRow(row));
    t.status = "completed";
    t.completedAt = new Date();
    t.lockedAt = null;
    t.lockedBy = null;
    t.updatedAt = new Date();
    const ts = now();
    this.db.prepare("UPDATE scheduled_tasks SET status = 'completed', locked_at = NULL, locked_by = NULL, data = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(t), ts, taskId);
  }

  async failTask(taskId: string, error: string, attempts: number, maxAttempts: number): Promise<void> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId) as { data: string } | undefined;
    if (!row) return;
    const t = hydrateTask(parseRow(row));
    t.attempts = attempts;
    t.lastError = error;
    t.lockedAt = null;
    t.lockedBy = null;
    t.updatedAt = new Date();
    const ts = now();

    if (attempts >= maxAttempts) {
      t.status = "failed";
    } else {
      const backoffMs = Math.min(2 ** attempts * 60 * 1000, 24 * 60 * 60 * 1000);
      t.status = "pending";
      t.runAt = new Date(Date.now() + backoffMs);
    }
    this.db.prepare(
      "UPDATE scheduled_tasks SET status = ?, run_at = ?, locked_at = NULL, locked_by = NULL, data = ?, updated_at = ? WHERE id = ?"
    ).run(t.status, t.runAt.toISOString(), JSON.stringify(t), ts, taskId);
  }

  async releaseTask(taskId: string): Promise<void> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId) as { data: string } | undefined;
    if (!row) return;
    const t = hydrateTask(parseRow(row));
    t.status = "pending";
    t.lockedAt = null;
    t.lockedBy = null;
    t.updatedAt = new Date();
    const ts = now();
    this.db.prepare("UPDATE scheduled_tasks SET status = 'pending', locked_at = NULL, locked_by = NULL, data = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(t), ts, taskId);
  }

  async cancelTask(taskId: string): Promise<void> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId) as { data: string } | undefined;
    if (!row) return;
    const t = hydrateTask(parseRow(row));
    t.status = "cancelled";
    t.cancelledAt = new Date();
    t.lockedAt = null;
    t.lockedBy = null;
    t.updatedAt = new Date();
    const ts = now();
    this.db.prepare("UPDATE scheduled_tasks SET status = 'cancelled', data = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(t), ts, taskId);
  }

  async getTaskById(taskId: string): Promise<StorageScheduledTask | null> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId) as { data: string } | undefined;
    if (!row) return null;
    return hydrateTask(parseRow(row));
  }

  async retryFailedTask(taskId: string): Promise<void> {
    this.ensureOpen();
    const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId) as { data: string } | undefined;
    if (!row) return;
    const t = hydrateTask(parseRow(row));
    t.status = "pending";
    t.runAt = new Date();
    t.attempts = 0;
    t.lastError = null;
    t.lockedAt = null;
    t.lockedBy = null;
    t.completedAt = null;
    t.updatedAt = new Date();
    const ts = now();
    this.db.prepare(
      "UPDATE scheduled_tasks SET status = 'pending', run_at = ?, data = ?, updated_at = ? WHERE id = ?"
    ).run(t.runAt.toISOString(), JSON.stringify(t), ts, taskId);
  }

  async bulkCancelPendingTasksForAdmin(filter: {
    adminGroupIds: string[];
    groupId?: string;
    memberEmail?: string;
    type?: StorageScheduledTask["type"];
  }): Promise<number> {
    this.ensureOpen();
    if (filter.adminGroupIds.length === 0) return 0;
    const adminSet = new Set(filter.adminGroupIds);
    const rows = this.db.prepare(
      `SELECT data FROM scheduled_tasks WHERE status IN ('pending', 'locked')`
    ).all() as { data: string }[];
    let n = 0;
    const ts = now();
    for (const row of rows) {
      const t = hydrateTask(parseRow(row));
      if (!taskVisibleToAdminGroups(t, adminSet)) continue;
      if (filter.groupId) {
        const touches =
          t.payload.groupId === filter.groupId ||
          t.payload.payments?.some((p) => p.groupId === filter.groupId);
        if (!touches) continue;
      }
      if (filter.memberEmail) {
        const want = filter.memberEmail.trim().toLowerCase();
        const email = String(t.payload.memberEmail ?? "").toLowerCase();
        if (email !== want) continue;
      }
      if (filter.type && t.type !== filter.type) continue;
      t.status = "cancelled";
      t.cancelledAt = new Date();
      t.lockedAt = null;
      t.lockedBy = null;
      t.updatedAt = new Date();
      this.db.prepare("UPDATE scheduled_tasks SET status = 'cancelled', data = ?, updated_at = ? WHERE id = ?").run(
        JSON.stringify(t),
        ts,
        t.id
      );
      n++;
    }
    return n;
  }

  async getTaskCounts(): Promise<{ pending: number; locked: number; completed: number; failed: number; cancelled: number }> {
    this.ensureOpen();
    const rows = this.db.prepare(
      "SELECT status, COUNT(*) as count FROM scheduled_tasks GROUP BY status"
    ).all() as { status: string; count: number }[];
    const counts = { pending: 0, locked: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const row of rows) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = row.count;
    }
    return counts;
  }

  async listTasks(options: {
    status?: StorageScheduledTask["status"];
    type?: StorageScheduledTask["type"];
    groupId?: string;
    anyGroupIdIn?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<{ tasks: StorageScheduledTask[]; total: number }> {
    this.ensureOpen();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.status) {
      conditions.push("status = ?");
      params.push(options.status);
    }
    if (options.type) {
      conditions.push("type = ?");
      params.push(options.type);
    }
    if (options.groupId) {
      conditions.push("json_extract(data, '$.payload.groupId') = ?");
      params.push(options.groupId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db.prepare(
      `SELECT data FROM scheduled_tasks ${where} ORDER BY run_at DESC`
    ).all(...params) as { data: string }[];

    let tasks = rows.map((r) => hydrateTask(parseRow(r)));
    if (options.anyGroupIdIn?.length) {
      const adminSet = new Set(options.anyGroupIdIn);
      tasks = tasks.filter((t) => taskVisibleToAdminGroups(t, adminSet));
    }

    const total = tasks.length;
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    tasks = tasks.slice(offset, offset + limit);

    return { tasks, total };
  }

  // ── price history ──────────────────────────────────────────────────────────

  async createPriceHistory(data: CreatePriceHistoryInput): Promise<StoragePriceHistory> {
    this.ensureOpen();
    const id = nanoid();
    const ts = now();
    const ph: StoragePriceHistory = {
      id,
      groupId: data.groupId,
      price: data.price,
      previousPrice: data.previousPrice,
      currency: data.currency,
      effectiveFrom: data.effectiveFrom,
      note: data.note ?? null,
      membersNotified: data.membersNotified ?? false,
      createdBy: data.createdBy,
      createdAt: new Date(ts),
    };
    this.db.prepare(`
      INSERT INTO price_history (id, group_id, data, created_at) VALUES (?, ?, ?, ?)
    `).run(id, data.groupId, JSON.stringify(ph), ts);
    return ph;
  }

  async getPriceHistoryForGroup(groupId: string): Promise<StoragePriceHistory[]> {
    this.ensureOpen();
    const rows = this.db.prepare(
      "SELECT data FROM price_history WHERE group_id = ? ORDER BY created_at DESC"
    ).all(groupId) as { data: string }[];
    return rows.map((r) => hydratePriceHistory(parseRow(r)));
  }

  // ── app settings (not persisted in SQLite; local mode uses config.json) ─────

  async ensureAppSettingsSeeded(): Promise<void> {
    this.ensureOpen();
  }

  async getAppSettingRow(_key: string): Promise<StorageAppSettingRow | null> {
    this.ensureOpen();
    return null;
  }

  async listAppSettingRows(_category?: string): Promise<StorageAppSettingRow[]> {
    this.ensureOpen();
    return [];
  }

  async upsertAppSettingRow(_input: StorageAppSettingRow): Promise<void> {
    this.ensureOpen();
  }

  // ── data portability ───────────────────────────────────────────────────────

  async exportAll(): Promise<ExportBundle> {
    this.ensureOpen();
    const groupRows = this.db.prepare("SELECT data FROM groups").all() as { data: string }[];
    const periodRows = this.db.prepare("SELECT data FROM billing_periods").all() as { data: string }[];
    const notifRows = this.db.prepare("SELECT data FROM notifications").all() as { data: string }[];
    const phRows = this.db.prepare("SELECT data FROM price_history").all() as { data: string }[];

    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      source: { mode: "local", appVersion: process.env.npm_package_version ?? "unknown" },
      data: {
        groups: groupRows.map((r) => hydrateGroup(parseRow(r))),
        billingPeriods: periodRows.map((r) => hydratePeriod(parseRow(r))),
        notifications: notifRows.map((r) => hydrateNotification(parseRow(r))),
        priceHistory: phRows.map((r) => hydratePriceHistory(parseRow(r))),
      },
    };
  }

  async importAll(bundle: ExportBundle): Promise<ImportResult> {
    this.ensureOpen();
    const errors: string[] = [];
    let groups = 0;
    let billingPeriods = 0;
    let notifications = 0;
    let priceHistory = 0;

    const importGroup = this.db.prepare(`
      INSERT OR IGNORE INTO groups (id, admin_id, is_active, invite_code, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const importPeriod = this.db.prepare(`
      INSERT OR IGNORE INTO billing_periods (id, group_id, period_start, collection_opens_at, is_fully_paid, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const importNotif = this.db.prepare(`
      INSERT OR IGNORE INTO notifications (id, group_id, data, created_at) VALUES (?, ?, ?, ?)
    `);
    const importPh = this.db.prepare(`
      INSERT OR IGNORE INTO price_history (id, group_id, data, created_at) VALUES (?, ?, ?, ?)
    `);

    const runImport = this.db.transaction(() => {
      for (const g of bundle.data.groups) {
        try {
          importGroup.run(
            g.id, g.adminId, g.isActive ? 1 : 0, g.inviteCode ?? null,
            JSON.stringify(g), new Date(g.createdAt).toISOString(), new Date(g.updatedAt).toISOString()
          );
          groups++;
        } catch (e) {
          errors.push(`group ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      for (const p of bundle.data.billingPeriods) {
        try {
          importPeriod.run(
            p.id, p.groupId,
            new Date(p.periodStart).toISOString(),
            p.collectionOpensAt ? new Date(p.collectionOpensAt).toISOString() : null,
            p.isFullyPaid ? 1 : 0,
            JSON.stringify(p),
            new Date(p.createdAt).toISOString(), new Date(p.updatedAt).toISOString()
          );
          billingPeriods++;
        } catch (e) {
          errors.push(`period ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      for (const n of bundle.data.notifications) {
        try {
          importNotif.run(n.id, n.groupId ?? null, JSON.stringify(n), new Date(n.createdAt).toISOString());
          notifications++;
        } catch (e) {
          errors.push(`notification ${n.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      for (const ph of bundle.data.priceHistory) {
        try {
          importPh.run(ph.id, ph.groupId, JSON.stringify(ph), new Date(ph.createdAt).toISOString());
          priceHistory++;
        } catch (e) {
          errors.push(`priceHistory ${ph.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    });

    runImport();
    return { groups, billingPeriods, notifications, priceHistory, errors };
  }
}
