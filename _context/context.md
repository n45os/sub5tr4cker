<!-- context-status: active -->
<!-- last-updated: 2026-03-26 -->

# SubsTrack — Project Context

Open-source Next.js app for managing shared subscriptions. Admin pays for a service, splits cost with members, automates reminders and payment tracking.

## Quick Facts

- **Stack**: Next.js 15 (App Router), MongoDB/Mongoose **or SQLite (local mode)**, Auth.js v5, Resend, grammy, node-cron, persisted notification task queue (ScheduledTask)
- **UI**: Tailwind CSS + shadcn/ui with a sidebar dashboard shell, richer cards, tabs, and settings surfaces
- **Origin**: Migrated from a Google Sheets + Apps Script setup (see `docs/legacy/`)
- **Phase**: Core MVP plus dashboard refresh (including an admin "subscriptions you pay for" table), editable groups with soft-delete from the UI, DB-backed app settings (Mongo via `MongooseAdapter` in advanced mode; `config.json` in local mode), notification previews, **scheduled tasks** page for admins to cancel/retry queued reminders, per-group email accent + style presets with live preview, shared themed email templates, aggregated reminders by user (optional), profile email/Telegram toggles, optional per-group **save email params** for Activity sent-email preview. **Local-first mode** via `s54r` CLI (SQLite, no MongoDB, auto-login, Telegram polling, OS-native cron, export/import/migrate). **API routes, cron jobs, Activity, member portal, and grammy handlers** use the shared `StorageAdapter` (`db()`) so local and advanced modes share one code path.

## Key Directories

- `src/app/` — pages + API routes (auth, dashboard, groups, billing, telegram, cron)
- `src/app/(auth)/` — login, register
- `src/app/(dashboard)/` — dashboard home, group detail/edit/new, notification previews, scheduled tasks (queue), activity, settings
- `src/app/api/` — groups CRUD, group notification toggles, billing, notifications, scheduled tasks (queue admin), settings, confirm, telegram webhook/link, cron, register
- `src/lib/` — db, auth, settings service, tokens (confirmation + link), email, telegram, billing calculator, notifications, tasks (queue + worker)
- `src/lib/storage/` — `StorageAdapter` interface, `MongooseAdapter`, `SqliteAdapter`, domain types, adapter factory
- `src/lib/config/` — `ConfigManager` (reads/writes `~/.sub5tr4cker/config.json`), local-mode setting helpers
- `src/lib/auth/local.ts` — local-mode auth token generation and cookie validation
- `src/models/` — Mongoose schemas (User, Group, BillingPeriod, PriceHistory, Notification, Settings, ScheduledTask)
- `src/jobs/` — check-billing-periods, enqueue-reminders, enqueue-follow-ups, reconcile-overdue, send-follow-ups, run-notification-tasks, runner
- `src/cli/` — Commander CLI (`s54r` / `substrack`), local commands (init, start, notify, export, import, migrate, cron-install, uninstall)
- `src/components/features/groups/` — GroupCard, group form, delete-group flow, and group UI
- `docs/` — architecture plan, data models, API design

## Core Flow

1. Admin creates group → adds members → sets billing config
2. Cron creates billing periods monthly when the collection window opens (renewal day, or earlier if the group uses payment in advance), or manual for variable mode
3. Reminders sent via email/Telegram with payment link
4. Member verifies payment via member-portal deep link (`?pay=...&open=confirm`), `POST .../self-confirm`, or Telegram → `admin_confirmation_request` notifies the admin (Telegram when linked and Telegram notifications are on; otherwise email if allowed)
5. Admin confirms in dashboard or via Telegram → status confirmed

**Reminder paths:** Cron enqueues `ScheduledTask` rows (`payment_reminder`, `aggregated_payment_reminder`, `admin_confirmation_request` only). Manual dashboard **Notify unpaid** sends aggregated reminders **without** the queue (see `docs/api-design.md` Flows).

## Operating Modes

| Mode | Storage | Auth | Telegram | Setup |
|------|---------|------|----------|-------|
| **local** | SQLite (`~/.sub5tr4cker/data.db`) | Token cookie (auto-login) | Polling | `s54r init` |
| **advanced** | MongoDB | Auth.js v5 / NextAuth | Webhook | `s54r setup` or env vars |

Switch: `SUB5TR4CKER_MODE=local` (set by `s54r start`).

## Implemented APIs (see docs/api-design.md)

- Groups: GET/POST /api/groups, GET/PATCH/DELETE /api/groups/[groupId]
- Group notifications: PATCH /api/groups/[groupId]/notifications (includes `saveEmailParams`)
- Activity: GET /api/activity, GET /api/activity/notifications/[notificationId]/email (rebuild from stored template params)
- Members: POST/PATCH/DELETE /api/groups/[groupId]/members(/[memberId])
- Billing: GET/POST /api/groups/[groupId]/billing, PATCH period, confirm, self-confirm
- Notifications: GET /api/notifications (templates list/preview APIs exist but are deprecated for first-party UI — use `docs/api-design.md`)
- Group preview: GET /api/groups/[groupId]/notification-preview (deprecated for first-party UI)
- Settings: GET/PATCH /api/settings, POST /api/settings/test-email, POST /api/settings/test-telegram
- Auth: /api/auth/[...nextauth], POST /api/register
- Telegram: POST /api/telegram/webhook, POST /api/telegram/link
- Dashboard: GET /api/dashboard/quick-status (aligned `unpaidCount` rules with GET /api/groups; `groupsNeedingAttention` / `groupsEligibleForReminders`), GET/POST /api/dashboard/notify-unpaid (POST accepts optional groupIds, paymentIds, channelPreference; always groups by member email for one combined message per user; cron aggregation uses the notifications.aggregateReminders setting)
- Scheduled tasks (admin): GET /api/scheduled-tasks, PATCH /api/scheduled-tasks/[taskId], POST /api/scheduled-tasks/bulk-cancel
- Cron: POST /api/cron/billing, reminders, follow-ups, notification-tasks (x-cron-secret)
- Confirm: GET /api/confirm/[token] (email "I paid")

## Context Files

- `_context/architecture.md` — system design details
- `_context/stack.md` — dependencies and versions
- `_context/conventions.md` — code patterns
- `_context/integrations.md` — external service details
