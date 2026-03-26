<!-- last-updated: 2026-03-26 -->

# Architecture

## Layers

1. **Presentation** — Next.js pages (RSC + client components), shadcn/ui
2. **API** — Next.js route handlers under `src/app/api/`
3. **Service** — business logic in `src/lib/` (billing calculator, notification dispatcher)
4. **Storage Adapter** — `StorageAdapter` interface (`src/lib/storage/`) abstracts all data access; `MongooseAdapter` wraps Mongoose, `SqliteAdapter` wraps better-sqlite3; adapter factory selects based on `SUB5TR4CKER_MODE`
5. **Data** — Mongoose models in `src/models/` (advanced mode) or SQLite JSON columns (local mode)
6. **External** — MongoDB, Resend (email), Telegram Bot API

## Storage Adapter Layer

`StorageAdapter` interface defines all operations (groups, billing periods, payments, notifications, audit events, list/query helpers for activity, scheduled tasks, price history, app settings rows in advanced mode, export/import). Route handlers, jobs, telegram handlers, and settings persistence (non-local) call `db()` instead of importing Mongoose models directly. Both adapters produce and consume the same domain types (`src/lib/storage/types.ts`). Adapter is selected lazily on first `getAdapter()` call:

- `SUB5TR4CKER_MODE=local` → `SqliteAdapter(~/.sub5tr4cker/data.db)`
- `SUB5TR4CKER_MODE=advanced` (default) → `MongooseAdapter`

## Notification System

Unified dispatcher in `src/lib/notifications/service.ts` that routes to:
- Email via Resend (`src/lib/email/`)
- Telegram via grammy (`src/lib/telegram/`)

Email templates now share a common shell (`src/lib/email/layout.ts`) and theme presets (`src/lib/email/themes.ts`) selected per group via `group.service.emailTheme`.

Members choose their preferred channel(s). The dispatcher checks preferences and sends accordingly.

## Payment Confirmation

Primary flow uses member-portal deep links from reminder emails (`/member/[token]?pay=<periodId>&open=confirm`) so members review details before confirming. Legacy HMAC token links (`/api/confirm/[token]`) remain as fallback for previously sent emails. Telegram uses inline keyboard callbacks with colon-delimited data.

## Cron Jobs and Notification Queue

- **Reconciliation** — Cron runs billing period creation and overdue state (pending → overdue) in `src/jobs/`.
- **Notification delivery** — Producers enqueue tasks into `ScheduledTask`; worker in `src/lib/tasks/worker.ts` claims due tasks and sends via `src/lib/notifications/service.ts`. Idempotency per business event; retries with backoff.
- Self-hosted: node-cron process (`src/jobs/runner.ts`) runs billing, enqueue reminders/follow-ups, and the notification worker every 5 min.
- Hosted: HTTP endpoints `/api/cron/*` (billing, reminders, follow-ups, notification-tasks) protected by `x-cron-secret`; call notification-tasks frequently to process the queue.
- Local mode: `s54r notify` is a standalone cron script — polls Telegram, runs the notification worker, enqueues reminders, exits. Installed via `s54r cron-install` using OS-native schedulers (crontab / launchd / Windows Task Scheduler).

## Telegram Bot

grammy library. Two modes:
- **Local mode** — `pollOnce()` (cron one-shot via `s54r notify`) and `startPolling()` (`bot.start()` long-poll loop alongside `s54r start`); last `update_id` persisted in `config.json`
- **Advanced mode** — webhook (`/api/telegram/webhook`); requires a public URL

Reminder keyboards include **Show paying details** (`paydetails:periodId:memberId`): handler loads the billing period's group and replies with platform, link, instructions, and optional announcement note (plain text).
