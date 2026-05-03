---
name: see-ref-storage
description: Reference for the StorageAdapter (dual-mode SQLite + Mongoose) — interface surface, mode selection, gotchas. Load explicitly when working on data access.
---

# Storage adapter module reference

## Purpose
Dual-mode abstraction over **SQLite** (local mode) and **Mongoose/MongoDB** (advanced mode). All API routes, cron jobs, and CLI code operate on plain domain types via the `StorageAdapter` interface and never import Mongoose models directly. The `db()` factory in [src/lib/storage/index.ts:49](src/lib/storage/index.ts:49) selects + memoizes the adapter based on `SUB5TR4CKER_MODE`.

## Main functionalities
- Users (CRUD, email lookup, Telegram chatId lookup, link-with-code)
- Groups (CRUD with embedded members; soft-delete; invite-code search)
- Billing periods (CRUD, dedup by `(group, periodStart)`, open-window query)
- Payment status updates (per-member, embedded in period)
- Notifications (delivery log + activity rebuild)
- Audit events (write-only)
- Scheduled tasks (enqueue with idempotency, optimistic-lock claim, complete/fail/cancel/retry)
- Settings (Mongoose only; SQLite reads `~/.sub5tr4cker/config.json` instead)
- Export / import bundles for `s54r migrate`

## Code map

### Interface + types
- [src/lib/storage/adapter.ts](src/lib/storage/adapter.ts) — `StorageAdapter` interface (32 methods)
- [src/lib/storage/types.ts](src/lib/storage/types.ts) — `StorageUser`, `StorageGroup`, `StorageGroupMember`, `StorageBillingPeriod`, `StorageNotification`, `StorageScheduledTask`, `StorageAuditEvent`, input/query types
- [src/lib/storage/api.ts](src/lib/storage/api.ts) — `isStorageId()`, `toApiShape()` (`id` → `_id` for response envelope)

### Mongoose adapter
- [src/lib/storage/mongoose-adapter.ts](src/lib/storage/mongoose-adapter.ts) — full impl; `userToStorage()`, `groupToStorage()`, `periodToStorage()`, `taskToStorage()`, `appSettingToStorage()`
- [src/lib/db/mongoose.ts](src/lib/db/mongoose.ts) — connection singleton (`dbConnect()`)

### SQLite adapter
- [src/lib/storage/sqlite-adapter.ts](src/lib/storage/sqlite-adapter.ts) — `better-sqlite3`, JSON `data` columns + indexed scalar columns, ISO-string date convention, schema in `SCHEMA_SQL`

### Factory
- [src/lib/storage/index.ts](src/lib/storage/index.ts) — `getAdapter()`, `db()` (initialize + memoize), `setAdapter()` / `resetAdapter()` for tests

### Settings shim
- [src/lib/settings/service.ts](src/lib/settings/service.ts) — `getSetting()` branches: advanced → adapter, local → config manager
- [src/lib/config/manager.ts](src/lib/config/manager.ts) — local-mode read/write of `~/.sub5tr4cker/config.json`

## Key entrypoints
1. [src/lib/storage/index.ts:49](src/lib/storage/index.ts:49) — `db()` is the only legal way to get the adapter
2. [src/lib/storage/adapter.ts:27](src/lib/storage/adapter.ts:27) — interface contract
3. [src/lib/storage/types.ts](src/lib/storage/types.ts) — single source of truth for domain shape (no Mongoose / no `ObjectId` leakage)
4. [src/lib/db/mongoose.ts:19](src/lib/db/mongoose.ts:19) — `dbConnect()` cached for serverless reuse
5. [src/lib/settings/service.ts:102](src/lib/settings/service.ts:102) — `getSetting()` mode-branched

## Module-specific conventions
- **IDs**: domain layer is `string` everywhere — `nanoid` in SQLite, `ObjectId.toString()` in Mongoose. Routes never see raw `ObjectId`.
- **Dates**: domain is `Date`; SQLite stores ISO strings and re-hydrates via `PERIOD_DATE_KEYS`-style lists; Mongoose stores native `Date`.
- **JSON column convention (SQLite)**: indexed/queried fields hoisted to scalar columns; everything else lives in a single `data` JSON column. Allows schema evolution without migrations.
- **Mode selection**: `SUB5TR4CKER_MODE=local` → SQLite; otherwise Mongoose. SqliteAdapter is **lazy-loaded** so advanced builds don't bundle `better-sqlite3`.
- **Settings**: Mongoose-only. Local mode bypasses the adapter entirely and reads `config.json`.

## Cross-cutting
- Every API route, cron job, and CLI command goes through `db()`. **Never import Mongoose models directly in route handlers** — that breaks local mode (CLAUDE.md is explicit).
- `getSetting("security.cronSecret")` gates every cron route.
- `MongoDBAdapter` (Auth.js) needs `mongodb@^6` as a direct dep — keep it pinned.

## Gotchas
- **No "create-or-get" semantics for billing periods.** Both adapters enforce `(group, periodStart)` UNIQUE (Mongoose `index({}, { unique: true })` in [src/models/billing-period.ts:87](src/models/billing-period.ts:87); SQLite `idx_bp_group_start` in [src/lib/storage/sqlite-adapter.ts:60](src/lib/storage/sqlite-adapter.ts:60)). Callers MUST query first AND handle the conflict on insert (`E11000` for Mongo, `UNIQUE constraint failed` for SQLite). The current call sites do query, but a race is still possible — see `see-ref-billing` for the active duplicate-period bug.
- **MemberId vs userId vs email** — Telegram-only members have `userId: null` and `email: null`; the only stable handle is the embedded `member.id`. Notification targeting uses a fallback chain (linked user → email → memberId).
- **SQLite has no migrations framework.** Schema lives in a single `SCHEMA_SQL` constant applied idempotently on `initialize()`. Schema changes require manual SQL edits + careful release notes.
- **No multi-statement transactions** exposed by the adapter. Each call is atomic on its own. Multi-step write flows (create period → enqueue task) can leave inconsistent state if one fails — manual cron re-run is the recovery path.
- Settings + Auth.js MongoDBAdapter both need `mongodb@^6`; mixing package managers (npm vs pnpm) has caused peer-mismatch breakage in the past.

## Related modules
- `see-ref-billing` — biggest consumer; relies on the unique index for dedup
- `see-ref-notifications` — logs every send, reads `getGroupWithMemberUsers`
- `see-ref-jobs` — task queue lives entirely on this surface
- `see-ref-auth` — `getUser`, `getUserByEmail`, `updateUser` for auth flows

## Updating this ref
If you add a new entity to the adapter, update both the interface entry and the corresponding adapter sections in this ref.
