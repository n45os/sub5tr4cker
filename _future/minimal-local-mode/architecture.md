# Architecture: sub5tr4cker — Minimal Local-First SubsTrack

## Approach

The core architectural change is introducing a **storage adapter layer** between the application logic and the database. Today SubsTrack talks directly to Mongoose/MongoDB. The new design extracts all data access into a `StorageAdapter` interface with two implementations: `SqliteAdapter` (for local/minimal) and `MongooseAdapter` (for advanced/cloud). The application code — billing calculation, notification dispatch, period management — calls the adapter interface and is storage-agnostic.

The CLI tool (`s54r`) acts as the entry point for local mode. It orchestrates the setup wizard, manages the data directory at `~/.sub5tr4cker/`, starts the Next.js web UI, and provides standalone commands for notifications and data management. The web app itself is bundled inside the npm package as a pre-built Next.js production build.

In local mode, there is no multi-user auth. A single auto-generated token is stored in `~/.sub5tr4cker/config.json` and set as a cookie on first browser visit. The "admin" is implicitly the person running the app. The User model is reduced to a config entry rather than a full database record.

This approach is inspired by OpenClaw's adapter pattern (see `openclaw-architecture/06-tools-and-execution.md` for their tool catalog abstraction) where the same business logic runs against multiple backends through a clean interface boundary.

## Components

### CLI Entry Point (`s54r`)
- **Purpose**: all user-facing commands — init, start, stop, notify, export, import, migrate, cron-install, uninstall
- **Tech**: Node.js bin script, `@clack/prompts` for interactive wizard, `commander` or `citty` for command parsing
- **Integrates with**: config manager, storage adapter, Next.js app launcher

### Storage Adapter Interface
- **Purpose**: abstract data access layer that both SQLite and MongoDB implementations conform to
- **Tech**: TypeScript interface defining CRUD operations for each entity (groups, billing periods, notifications, etc.)
- **Integrates with**: all business logic (billing, notifications, period management)

```typescript
interface StorageAdapter {
  // groups
  createGroup(data: GroupInput): Promise<Group>;
  getGroup(id: string): Promise<Group | null>;
  listGroups(): Promise<Group[]>;
  updateGroup(id: string, data: Partial<GroupInput>): Promise<Group>;
  deleteGroup(id: string): Promise<void>;

  // billing periods
  createBillingPeriod(data: BillingPeriodInput): Promise<BillingPeriod>;
  getOpenPeriods(groupId: string): Promise<BillingPeriod[]>;
  updatePaymentStatus(periodId: string, memberId: string, status: PaymentStatus): Promise<void>;

  // notifications
  logNotification(data: NotificationInput): Promise<void>;
  getNotificationHistory(groupId: string): Promise<Notification[]>;

  // data portability
  exportAll(): Promise<ExportBundle>;
  importAll(bundle: ExportBundle): Promise<ImportResult>;

  // lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}
```

### SQLite Adapter
- **Purpose**: local storage backend using better-sqlite3 with document-store pattern
- **Tech**: `better-sqlite3`, JSON columns for document-like storage, real SQL for queries
- **Integrates with**: StorageAdapter interface, data directory at `~/.sub5tr4cker/data.db`

Database schema (document-store approach with typed tables):
```sql
-- core tables with JSON data columns for document-like flexibility
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  data JSON NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE billing_periods (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  data JSON NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  data JSON NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- indexes for common queries
CREATE INDEX idx_bp_group ON billing_periods(group_id);
CREATE INDEX idx_bp_open ON billing_periods(json_extract(data, '$.isFullyPaid'));
CREATE INDEX idx_notif_group ON notifications(group_id);
```

### Mongoose Adapter
- **Purpose**: wraps existing Mongoose models behind the StorageAdapter interface
- **Tech**: existing Mongoose models (Group, BillingPeriod, etc.), thin wrapper translating interface calls to Mongoose operations
- **Integrates with**: existing MongoDB infrastructure, StorageAdapter interface

### Config Manager
- **Purpose**: manages `~/.sub5tr4cker/config.json` — stores mode (local/advanced), notification channel settings, auth token, cron state
- **Tech**: plain JSON file, validated with Zod on read
- **Integrates with**: CLI wizard (writes config), web app (reads config), notify script (reads config)

```typescript
interface Sub5tr4ckerConfig {
  mode: 'local' | 'advanced';
  version: string;
  port: number; // default 3054
  authToken: string; // auto-generated on init

  notifications: {
    channels: {
      email?: {
        provider: 'resend';
        apiKey: string;
        fromAddress: string;
      };
      telegram?: {
        botToken: string;
        pollingEnabled: boolean;
      };
    };
    defaultChannel: 'email' | 'telegram';
  };

  // only used in advanced mode
  mongodb?: {
    uri: string;
  };

  cron: {
    installed: boolean;
    method: 'crontab' | 'launchd' | 'task-scheduler' | 'manual';
    interval: string; // cron expression, default '*/30 * * * *'
  };
}
```

### Notify Script
- **Purpose**: standalone Node.js script that checks due notifications and sends them, then exits
- **Tech**: imports core business logic directly (no HTTP, no Next.js), reads config + SQLite, calls Resend/Telegram APIs
- **Integrates with**: storage adapter (read billing periods, update statuses), notification service (send emails/messages), config manager

Flow:
1. read `~/.sub5tr4cker/config.json`
2. initialize storage adapter (SQLite or MongoDB based on mode)
3. query open billing periods where `collectionOpensAt <= now`
4. for each period with unpaid members past grace period → send reminder
5. log notifications, update records
6. close adapter, exit process (total runtime: 1-3 seconds)

### Web UI Adapter
- **Purpose**: the existing Next.js app, modified to read storage mode from config and use the appropriate adapter
- **Tech**: Next.js 15 (App Router), pre-built and bundled in the npm package
- **Integrates with**: storage adapter (chosen at startup based on config), config manager

Key changes to the existing web app:
- API routes get the adapter from a singleton factory instead of importing Mongoose directly
- auth middleware checks the token cookie in local mode instead of Auth.js sessions
- member-facing pages are hidden/disabled in local mode (admin-only dashboard)
- settings page gains export/import/backup buttons
- no user registration flow in local mode

### Notification Channel Registry
- **Purpose**: pluggable notification channels — currently email and Telegram, designed for future expansion
- **Tech**: channel interface with `send()`, `canConfirm()`, `handleCallback()` methods
- **Integrates with**: notify script, web app notification dispatch, config manager

```typescript
interface NotificationChannel {
  id: string;
  name: string;
  canSendReminders: boolean;
  canReceiveConfirmations: boolean;
  requiresSetup: string[]; // list of config keys needed

  send(recipient: Recipient, message: NotificationMessage): Promise<void>;
  handleCallback?(payload: unknown): Promise<ConfirmationResult | null>;
}
```

### Export/Import Engine
- **Purpose**: produces and consumes a universal JSON bundle that works across both storage backends
- **Tech**: JSON schema with versioning, Zod validation on import
- **Integrates with**: both storage adapters (each implements exportAll/importAll), CLI commands

```typescript
interface ExportBundle {
  version: string; // schema version, e.g. "1.0.0"
  exportedAt: string; // ISO date
  source: { mode: 'local' | 'advanced'; appVersion: string };
  data: {
    groups: GroupExport[];
    billingPeriods: BillingPeriodExport[];
    notifications: NotificationExport[];
  };
}
```

## Data Flow

### Init Flow (first run)
1. user runs `npx s54r`
2. wizard: welcome screen → choose notification channel(s) → provide API keys/tokens → confirm
3. create `~/.sub5tr4cker/` directory
4. write `config.json` with chosen settings + auto-generated auth token
5. initialize SQLite database with schema
6. print: "Setup complete. Starting SubsTrack on http://localhost:3054"
7. launch `next start` on port 3054
8. open browser to `http://localhost:3054` (auto-authenticated via token cookie)
9. user creates groups and members via web UI
10. print: "To enable automatic reminders, run: s54r cron-install"

### Notification Flow (cron)
1. cron fires `s54r notify`
2. notify script reads config, initializes SQLite adapter
3. queries billing periods where collection is open and has unpaid members past grace
4. for each: sends reminder via configured channel (Resend email or Telegram message)
5. for Telegram: if bot is configured, does a quick `getUpdates` poll to check for "I paid" callbacks since last check
6. processes any callbacks: updates payment status to `member_confirmed`
7. logs all notifications, closes adapter, exits

### Uninstall Flow
1. user runs `s54r uninstall`
2. prompt: "Would you like to export a backup before uninstalling? [Y/n]"
3. if yes: runs full export → saves JSON to current directory (~/sub5tr4cker-backup-{date}.json)
4. prompt: "This will remove all SubsTrack data from ~/.sub5tr4cker/ and uninstall cron entries. Continue? [y/N]"
5. if confirmed: remove cron/launchd entry, delete `~/.sub5tr4cker/` directory
6. print: "SubsTrack has been uninstalled. Your backup is at {path}. To uninstall the CLI: npm uninstall -g sub5tr4cker"

### Migration Flow (local → advanced)
1. user runs `s54r migrate`
2. prompt: "This will migrate your data from local SQLite to MongoDB. You'll need a MongoDB connection URI."
3. collect MongoDB URI, test connection
4. export all data from SQLite adapter via `exportAll()`
5. initialize Mongoose adapter with the MongoDB URI
6. import data via `importAll()`
7. update `config.json`: mode → 'advanced', add mongodb.uri
8. print: "Migration complete. {N} groups, {M} billing periods migrated. You can now run the full SubsTrack app."

## Integration Points

- **Existing src/lib/billing/**: calculation logic stays unchanged, just called through the adapter
- **Existing src/lib/notifications/**: dispatch logic stays, but gets the recipient data from the adapter instead of Mongoose
- **Existing src/lib/telegram/**: bot instance and handlers reused, but polling mode added for local (currently webhook-only)
- **Existing src/app/api/**: routes refactored to use `getAdapter()` instead of importing models directly
- **Existing src/components/**: UI components reused, feature flags hide member-facing / advanced features in local mode

## Tech Stack Additions

| Technology | Purpose | Why this one |
|-----------|---------|-------------|
| better-sqlite3 | local embedded database | fastest SQLite for Node.js, sync API, JSON support, single file |
| @clack/prompts | CLI setup wizard | beautiful terminal UI, 4KB, typed, modern API |
| commander / citty | CLI command parsing | standard for npm CLI tools, subcommand support |
| nanoid | ID generation for SQLite records | URL-safe, compact, no UUID dependency |
| conf / cosmiconfig | config file management | standard patterns for ~/.config style files |
