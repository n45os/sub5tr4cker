---
name: see-ref-api-routes
description: Reference for the API routes surface — resource families, conventions, cron-secret pattern. Load explicitly when working across HTTP endpoints.
---

# API routes reference

## Purpose
Next.js App Router REST surface backing the dashboard, member portal, cron tasks, Telegram webhook, and CLI integrations. All routes operate on the dual-mode `StorageAdapter` and the unified `auth()` wrapper, so each route file is mode-agnostic.

## Main functionalities
- Group lifecycle (CRUD, soft-delete, invite-link toggling)
- Billing management (periods, recalc, advance, backfill, import, confirm)
- Member operations (add/edit/remove, invite, telegram deep-link)
- Payment confirmation (email token, member portal, admin verify/reject)
- Cron jobs (`x-cron-secret` gated): billing, reminders, follow-ups, notification worker
- Notification dispatch (manual + queued) and template preview
- Scheduled-tasks queue admin (list/cancel/retry/bulk-cancel)
- Telegram webhook + bot linking
- Auth + user profile + change password
- Settings (read/update + test email/Telegram)
- Activity feed + email preview rebuild

## Code map (by family)

### Groups & invites
- [src/app/api/groups/route.ts](src/app/api/groups/route.ts) — GET / POST
- [src/app/api/groups/[groupId]/route.ts](src/app/api/groups/[groupId]/route.ts) — GET / PATCH / DELETE
- [src/app/api/groups/[groupId]/notifications/route.ts](src/app/api/groups/[groupId]/notifications/route.ts)
- [src/app/api/groups/[groupId]/invite-link/route.ts](src/app/api/groups/[groupId]/invite-link/route.ts) — GET / POST / PATCH / DELETE
- [src/app/api/invite/[inviteCode]/route.ts](src/app/api/invite/[inviteCode]/route.ts) (public preview), [src/app/api/groups/join/route.ts](src/app/api/groups/join/route.ts) (public join)

### Members
- [src/app/api/groups/[groupId]/members/route.ts](src/app/api/groups/[groupId]/members/route.ts) — POST add
- [src/app/api/groups/[groupId]/members/[memberId]/](src/app/api/groups/[groupId]/members/[memberId]) — PATCH / DELETE / send-invite / telegram-invite

### Billing & payment
- [src/app/api/groups/[groupId]/billing/route.ts](src/app/api/groups/[groupId]/billing/route.ts)
- [src/app/api/groups/[groupId]/billing/[periodId]/](src/app/api/groups/[groupId]/billing/[periodId]) — confirm / self-confirm / recalculate / PATCH / DELETE
- [src/app/api/groups/[groupId]/billing/{reconcile,advance,backfill,import}/route.ts](src/app/api/groups/[groupId]/billing)
- [src/app/api/confirm/[token]/route.ts](src/app/api/confirm/[token]/route.ts) — legacy email confirm

### Dashboard
- [src/app/api/dashboard/quick-status/route.ts](src/app/api/dashboard/quick-status/route.ts)
- [src/app/api/dashboard/notify-unpaid/route.ts](src/app/api/dashboard/notify-unpaid/route.ts) — GET preview / POST send (manual; bypasses queue and grace)

### Cron (x-cron-secret)
- [src/app/api/cron/billing/route.ts](src/app/api/cron/billing/route.ts)
- [src/app/api/cron/reminders/route.ts](src/app/api/cron/reminders/route.ts)
- [src/app/api/cron/follow-ups/route.ts](src/app/api/cron/follow-ups/route.ts)
- [src/app/api/cron/notification-tasks/route.ts](src/app/api/cron/notification-tasks/route.ts)

### Notifications
- [src/app/api/groups/[groupId]/notify/route.ts](src/app/api/groups/[groupId]/notify/route.ts)
- [src/app/api/notifications/](src/app/api/notifications) — list / templates / template preview

### Scheduled tasks
- [src/app/api/scheduled-tasks/](src/app/api/scheduled-tasks) — list / [taskId] / bulk-cancel

### Telegram
- [src/app/api/telegram/webhook/route.ts](src/app/api/telegram/webhook/route.ts)
- [src/app/api/telegram/link/route.ts](src/app/api/telegram/link/route.ts)
- [src/app/api/telegram/{webhook-info,set-webhook}/route.ts](src/app/api/telegram)

### Auth, user, settings, activity, payments, plugins, health
- [src/app/api/auth/[...nextauth]/route.ts](src/app/api/auth/[...nextauth]/route.ts)
- [src/app/api/register/route.ts](src/app/api/register/route.ts)
- [src/app/api/user/](src/app/api/user) — profile / change-password
- [src/app/api/settings/](src/app/api/settings) — list / update / test-email / test-telegram
- [src/app/api/activity/](src/app/api/activity) — list / per-notification email rebuild
- [src/app/api/payments/route.ts](src/app/api/payments/route.ts)
- [src/app/api/plugins/route.ts](src/app/api/plugins/route.ts)
- [src/app/api/health/route.ts](src/app/api/health/route.ts), [unsubscribe/[token]/route.ts](src/app/api/unsubscribe/[token]/route.ts)

## Key entrypoints
1. [src/app/api/groups/route.ts:54](src/app/api/groups/route.ts:54) — exemplar of `auth()` + `db()` + envelope
2. [src/app/api/cron/billing/route.ts:5](src/app/api/cron/billing/route.ts:5) — exemplar of `x-cron-secret` gating
3. [src/app/api/dashboard/notify-unpaid/route.ts:25](src/app/api/dashboard/notify-unpaid/route.ts:25) — manual reminder flow (preview vs send)
4. [src/app/api/confirm/[token]/route.ts:12](src/app/api/confirm/[token]/route.ts:12) — token verify + enqueue admin nudge + run worker
5. [src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts:14](src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts:14) — dual auth path (session OR portal JWT)
6. [src/app/api/telegram/webhook/route.ts:6](src/app/api/telegram/webhook/route.ts:6) — webhook secret + bot dispatch

## Module-specific conventions
- **Response envelope**: `{ data }` on success, `{ error: { code, message, details? } }` on failure. Health route is the only exception.
- **Validation order**: Zod schema (top of file) → Mongoose validation as second layer (advanced only).
- **Auth**: `await auth()` from `@/lib/auth` — same wrapper covers both modes.
- **Storage**: `const store = await db()` — never import Mongoose models in routes.
- **Cron**: `request.headers.get("x-cron-secret")` ⇔ `await getSetting("security.cronSecret")`.
- **Pagination**: `?page=1&limit=12` (max enforced per route, e.g. scheduled-tasks: 50). Returns `{ items, pagination: { page, totalPages, total } }`.
- **Type annotations** on Mongoose array methods inside route files to satisfy strict TS (e.g. `payments.map((p: StorageMemberPayment) => …)`).
- **Avoid huge inline object types** in callback signatures — Turbopack's parser sometimes chokes (`Expected ',', got ';'`). Hoist to a named `type`.

## Cross-cutting
- `auth()` (Auth.js v5 + local-mode wrapper)
- `db()` (StorageAdapter factory)
- `getSetting()` / `setSetting()` (settings service)
- `enqueueTask()` + `runNotificationTasks()` (queue)
- `verifyConfirmationToken()` / portal JWT helpers (`src/lib/tokens.ts`)
- `logAudit()` after mutations

## Gotchas
- Importing Mongoose models directly in a route handler **breaks local mode silently** — always use `db()`.
- `cache: "no-store"` is required for fetches that must always re-render; some pages omit it accidentally and serve stale data.
- The dashboard `/notify-unpaid` route ignores grace period; cron honors it. Different `getReminderEligibility()` call paths.
- Member email is lowercased + trimmed everywhere — comparisons must too, or you'll get phantom non-matches.
- Health route returns raw `{ status: "ok" }`, breaking the envelope by design — don't "fix" it.

## Related modules
- `see-ref-auth` — `auth()` semantics
- `see-ref-storage` — `db()` factory + adapter surface
- `see-ref-billing`, `see-ref-notifications`, `see-ref-jobs`, `see-ref-groups` — domain logic invoked by routes

## Updating this ref
When a new resource family is added, append it to the code map and bump the entry-point list if it deserves a contributor's first read.
