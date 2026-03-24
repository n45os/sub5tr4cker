---
title: API Reference
description: REST API endpoints, auth, and response formats.
---

# API Reference

All API routes live under `/api/`. Protected routes require a valid Auth.js session. Cron routes require the `x-cron-secret` header (value from app setting `security.cronSecret`).

**Flows:** Automatic reminders and admin follow-ups use the **ScheduledTask** queue + worker. Manual **Notify unpaid** (`POST /api/dashboard/notify-unpaid`) sends aggregated reminders inline (same channels, different pipeline) and updates period reminder metadata. Member “I paid” converges from email confirm, self-confirm API, and Telegram. See the full diagrams in the repo `docs/api-design.md` → Flows.

## Authentication

### `GET/POST /api/auth/[...nextauth]`

Auth.js catch-all. Handles sign-in, sign-out, session, and OAuth callbacks.

Providers: Credentials (email/password), Google OAuth.

## Groups

### `GET /api/groups`

List groups the authenticated user belongs to (admin or member).

**Response:** `{ "groups": [ { "_id", "name", "service", "role", "memberCount", "billing", "nextBillingDate", "unpaidCount" } ] }`

### `POST /api/groups`

Create a group. Body: `name`, `service`, `billing`, `payment`, `members`. `service` supports `accentColor` and `emailTheme` (`clean` | `minimal` | `bold` | `rounded` | `corporate`). Authenticated user becomes admin.

### `GET /api/groups/[groupId]`

Get group details. Admin sees full config; members see limited info.

### `PATCH /api/groups/[groupId]`

Update group. Admin only.

### `GET /api/groups/[groupId]/notification-preview`

**Deprecated** for first-party UI. Return rendered HTML preview for payment reminder email. Admin only.

Query params:
- `type` (currently `payment_reminder`)
- `theme` (optional theme override: `clean` | `minimal` | `bold` | `rounded` | `corporate`)

### `DELETE /api/groups/[groupId]`

Soft-deactivate group. Admin only.

## Members

### `POST /api/groups/[groupId]/members`

Add member. Body: `email`, `nickname`, `customAmount` (optional). Admin only.

### `PATCH /api/groups/[groupId]/members/[memberId]`

Update member. Admin only.

### `DELETE /api/groups/[groupId]/members/[memberId]`

Remove member (soft). Admin only.

## Billing

### `GET /api/groups/[groupId]/billing`

List billing periods. Query: `page`, `limit`, `status`.

### `POST /api/groups/[groupId]/billing`

Create billing period (e.g. variable mode). Admin only. Body: `periodLabel`, `totalPrice`, `periodStart`, `periodEnd`.

### `PATCH /api/groups/[groupId]/billing/[periodId]`

Update period (e.g. waive member, add notes). Admin only.

## Payment confirmation

### `GET /api/confirm/[token]`

Legacy “I’ve paid” email link handler. Token is HMAC-signed. No auth. Validates token, sets payment to `member_confirmed`, enqueues an admin verification nudge (Telegram when the admin has it linked and enabled; otherwise email if allowed), redirects to member portal.

### `POST /api/groups/[groupId]/billing/[periodId]/self-confirm`

Member marks paid from the app (session or `memberToken`). Same admin verification nudge enqueue as the email confirm flow.

New reminder emails route users to member portal deep links (`/member/[token]?pay=<periodId>&open=confirm`) so confirmation happens from the portal dialog.

### `POST /api/groups/[groupId]/billing/[periodId]/confirm`

Admin confirms a member’s payment. Body: `memberId`, `action` (`confirm` | `reject`), `notes` (optional).

## Notifications

### `POST /api/groups/[groupId]/notify`

Trigger notifications manually. Body: `type`, `message`, `channels`. Admin only.

### `GET /api/notifications/templates/[type]/preview`

Return one template preview with HTML, Telegram text, and variable metadata.

Query params:
- `theme` (optional theme override: `clean` | `minimal` | `bold` | `rounded` | `corporate`)

## Dashboard

Admin-only. Used by the dashboard home (quick status and bulk notify).

### `GET /api/dashboard/quick-status`

Admin-only. Returns `groupsNeedingAttention` (any open follow-up), `groupsEligibleForReminders` (pending/overdue only, matches bulk notify), plus payment-row counts. Same open-period rules as `unpaidCount` on `GET /api/groups`.

### `GET /api/dashboard/notify-unpaid`

Preview unpaid reminder candidates (by group, period, payment) with eligibility and skip reasons. No body. Always includes `byUser` (grouped by member email, case-insensitive) and `aggregateReminders: true`.

### `POST /api/dashboard/notify-unpaid`

Send payment reminders. Optional body: `groupIds` (string[]), `paymentIds` (string[]), `channelPreference` (`"email"` | `"telegram"` | `"both"`). Always groups by member email (one combined message per user). Response: `{ "data": { "emailSent", "telegramSent", "skipped", "failed" } }`.

## Scheduled tasks

Group admins only. Queue inspection and cancellation for groups you administer.

### `GET /api/scheduled-tasks`

Query: `page`, `limit`, optional `status`, optional `type`.

### `PATCH /api/scheduled-tasks/[taskId]`

Body: `{ "action": "cancel" | "retry" }` — cancel pending/locked tasks or retry failed ones.

### `POST /api/scheduled-tasks/bulk-cancel`

Body: at least one of `groupId`, `memberEmail`, `type`. Cancels matching pending/locked tasks.

## Cron

All cron routes require header: `x-cron-secret: <secret>`.

### `POST /api/cron/billing`

Create billing periods for due groups.

### `POST /api/cron/reminders`

Enqueue payment reminder tasks and run the notification worker. Response: `enqueued`, `worker` (claimed, completed, failed).

### `POST /api/cron/follow-ups`

Reconcile overdue payments and enqueue admin nudge tasks, then run the worker. Response: `overdueReconciled`, `adminNudgesEnqueued`, `worker`.

### `POST /api/cron/notification-tasks`

Run the notification task worker (claim and execute due tasks). Call frequently (e.g. every 5 min). Response: `claimed`, `completed`, `failed`, `counts` (pending, locked, completed, failed, cancelled).

## Error format

All errors use:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Common codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `INTERNAL_ERROR`.

## Success format

Successful responses use:

```json
{
  "data": { ... }
}
```

For the full request/response schemas and more endpoints, see `docs/api-design.md` in the repository.
