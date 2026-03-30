# AGENTS.md — sub5tr4cker

## Project Overview

sub5tr4cker is an open-source web app for managing shared subscriptions. An admin pays for a service (YouTube Premium, Netflix, etc.) and splits the cost with members. The app automates reminders, tracks payments, and handles confirmations.

**Tech**: Next.js 16 (App Router), MongoDB/Mongoose or SQLite (local mode), Auth.js v5, Resend (email), grammy (Telegram), node-cron, persisted notification task queue.

## Architecture

Read `docs/PLAN.md` for the full architecture. Key concepts:

- **Groups** — a shared subscription with an admin, members, and billing config
- **Billing periods** — monthly entries tracking who owes what
- **Payment flow** — pending → member_confirmed → confirmed (admin verifies)
- **Notification channels** — email (Resend) and Telegram (grammy)
- **Cron + task queue** — reconciliation jobs (billing periods, overdue state); notification delivery via enqueue + worker (ScheduledTask)

## Directory Map

```
src/
├── app/                    # pages and API routes (Next.js App Router)
│   ├── (auth)/             # auth pages (login, register)
│   ├── (dashboard)/        # protected pages (groups, settings, etc.)
│   ├── (public)/           # landing page
│   └── api/                # REST endpoints
│       ├── auth/           # Auth.js handler
│       ├── groups/         # group CRUD + members + billing
│       ├── confirm/        # email "I paid" token handler
│       ├── telegram/       # Telegram webhook
│       ├── cron/           # cron endpoints (billing, enqueue reminders/follow-ups, notification worker)
│       ├── notifications/  # manual notification triggers
│       ├── dashboard/      # quick-status, notify-unpaid
│       ├── activity/       # activity feed + notification email preview
│       ├── scheduled-tasks/ # admin task queue (list, cancel, retry)
│       ├── settings/       # app settings CRUD
│       ├── invite/         # group invite acceptance
│       ├── user/           # user profile
│       ├── register/       # user registration
│       ├── payments/       # member payment portal
│       ├── plugins/        # plugin management
│       └── health/         # health check endpoint
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # app shell (header, sidebar, footer)
│   └── features/           # feature components (groups, billing, etc.)
├── lib/
│   ├── db/mongoose.ts      # MongoDB connection singleton
│   ├── auth.ts             # Auth.js v5 configuration
│   ├── email/              # Resend client + React Email templates
│   ├── telegram/           # grammy bot, handlers, keyboards, send helpers
│   ├── billing/            # split calculation, period management
│   ├── notifications/      # unified dispatcher across channels
│   ├── tasks/              # task queue (enqueue, claim, worker)
│   ├── storage/            # StorageAdapter interface + SQLite/Mongoose implementations
│   ├── config/             # Config manager (~/.sub5tr4cker/config.json)
│   ├── auth/               # Auth.js + local-mode token auth (local.ts)
│   ├── settings/           # DB-backed app settings service
│   └── tokens.ts           # HMAC tokens for confirmation links
├── models/                 # Mongoose schemas (User, Group, BillingPeriod, ScheduledTask, etc.)
├── cli/                    # s54r CLI entry point + local/advanced commands
├── jobs/                   # cron logic (billing, enqueue-reminders/follow-ups, run-notification-tasks)
└── types/                  # shared TypeScript types
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/db/mongoose.ts` | MongoDB connection with caching for serverless |
| `src/lib/auth.ts` | Auth.js v5 config + local-mode auth wrapper (`auth()`) |
| `src/lib/auth/local.ts` | Local-mode token generation, cookie validation, synthetic session |
| `src/lib/config/manager.ts` | Config manager for `~/.sub5tr4cker/config.json` (local mode settings) |
| `src/lib/storage/adapter.ts` | `StorageAdapter` interface — all data operations |
| `src/lib/storage/types.ts` | Domain types (no Mongoose, no ObjectId) used by both adapters |
| `src/lib/storage/mongoose-adapter.ts` | Wraps Mongoose calls behind `StorageAdapter` |
| `src/lib/storage/sqlite-adapter.ts` | SQLite adapter for local mode (better-sqlite3, JSON columns) |
| `src/lib/storage/index.ts` | Adapter factory — selects SQLite or Mongoose from `SUB5TR4CKER_MODE` |
| `src/models/group.ts` | Group schema — the central data model |
| `src/models/billing-period.ts` | Billing period with per-member payment tracking |
| `src/lib/billing/calculator.ts` | Cost splitting logic (equal, fixed, variable) |
| `src/lib/billing/collection-window.ts` | Collection open date, grace-from-open, Mongo filter for open periods |
| `src/lib/notifications/service.ts` | Dispatches notifications across email + Telegram |
| `src/lib/telegram/bot.ts` | grammy bot instance, `setMyCommands`, handler registration |
| `src/lib/telegram/handlers.ts` | `/start` (link + invite payloads), `/services`, `/help`, callback handlers (payment confirmations) |
| `src/lib/telegram/member-onboarding-text.ts` | invite welcome copy, profile-link success, `/help` and `/services` message builders |
| `src/lib/telegram/polling.ts` | `pollOnce()` (cron) and `startPolling()` (server) for local mode |
| `src/lib/tokens.ts` | HMAC token generation/verification for email links |
| `src/jobs/runner.ts` | node-cron scheduler entry point |
| `src/cli/index.ts` | `s54r` CLI entry point — all local + advanced commands |
| `src/cli/commands/local/init.ts` | `s54r init` guided setup wizard |
| `src/cli/commands/local/notify.ts` | `s54r notify` standalone cron script |
| `src/components/features/groups/group-detail-admin-actions.tsx` | Group header: Edit + **⋯** menu (initialize, import, delete) |
| `src/components/features/groups/delete-group-button.tsx` | Admin soft-delete group (calls `DELETE /api/groups/[groupId]`) |
| `src/lib/tasks/worker.ts` | Executes scheduled notification tasks (skips if payment no longer unpaid) |
| `src/app/api/scheduled-tasks/` | Admin list/cancel/retry/bulk-cancel for the task queue |

## Data Models

See `docs/data-models.md`. Quick summary:

- **User** — auth account + notification preferences + Telegram link
- **Group** — subscription config, members (embedded), billing settings (`paymentInAdvanceDays`, etc.), payment method
- **BillingPeriod** — one cycle per group per month, `collectionOpensAt` for unpaid/open-period queries, per-member payment statuses
- **PriceHistory** — price change log per group
- **Notification** — delivery log for all sent messages
- **ScheduledTask** — queue for notification delivery (pending → locked → completed/failed/cancelled); task types used in production: `payment_reminder`, `aggregated_payment_reminder`, `admin_confirmation_request` only; admins manage via `/dashboard/scheduled-tasks` and `/api/scheduled-tasks/*`
- **AuditEvent** — audit trail for group operations, admin actions, and notifications

## Conventions

- **Comments**: lowercase first letter, no period at end (e.g., `// calculate member share`)
- **API responses**: always return `{ data }` on success, `{ error: { code, message } }` on failure
- **Mongoose models**: defined in `src/models/`, exported from `src/models/index.ts`
- **Validation**: Zod schemas in route handlers, Mongoose validation as second layer
- **Environment**: all secrets via env vars, never hardcoded. See `.env.example`
- **Imports**: use `@/*` alias (maps to `src/*`)
- **Components**: shadcn/ui for primitives, feature components in `src/components/features/`

## Common Tasks

### Adding a new API route

1. Create `src/app/api/<resource>/route.ts`
2. Add Zod validation schema at the top
3. Check auth with `auth()` from `@/lib/auth`
4. Use the storage adapter via `const store = await db()` from `@/lib/storage`
5. Return `NextResponse.json()`

### Adding a new notification type

1. Add the type to `Notification.type` enum in `src/models/notification.ts`
2. Create email template in `src/lib/email/templates/`
3. Add Telegram message builder in `src/lib/telegram/send.ts`
4. Register in `src/lib/notifications/service.ts`

### Local mode and `better-sqlite3`

- **`s54r start`** runs `next start` from the repo root (not only `.next/standalone/server.js`) so the native SQLite addon resolves from your real `node_modules` after `pnpm install`. If you see "Could not locate the bindings file", run `pnpm install` and rebuild (`pnpm build:standalone` or `s54r init`).

### Adding a new cron job

1. For **reconciliation** (e.g. billing periods): create job in `src/jobs/<job-name>.ts`, register in `src/jobs/runner.ts`, optionally add `src/app/api/cron/<job-name>/route.ts`.
2. For **notification delivery**: add a task type in `src/models/scheduled-task.ts`, implement producer (enqueue in `src/jobs/enqueue-*.ts` or similar), add handler in `src/lib/tasks/worker.ts`, and enqueue from cron or from API (e.g. confirm flow).

### After shipping a version

After a version bump in `package.json` and a new section in `CHANGELOG.md`, sync documentation using `.cursor/skills/release-docs-sync/SKILL.md`. This ensures `docs/`, `content/docs/`, and `_context/` stay aligned with the changelog.

## References

- Architecture plan: `docs/PLAN.md`
- Data models: `docs/data-models.md`
- API design: `docs/api-design.md` (includes **Flows**: billing lifecycle, queued vs manual reminders, member confirm paths)
- Original Google Sheets scripts: `docs/legacy/` (for reference)
