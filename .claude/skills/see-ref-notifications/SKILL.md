---
name: see-ref-notifications
description: Reference for the Notifications module — channels, templates, queue handlers, callback wiring. Load explicitly when working on email/Telegram notifications.
---

# Notifications module reference

## Purpose
Unified dispatcher across email (Resend + React Email templates) and Telegram (grammy). Wraps transactional sends, aggregated reminders, admin verification nudges, and announcements. Most automatic sends go through the persisted `ScheduledTask` queue with daily idempotency keys; the manual dashboard "notify unpaid" path delivers inline.

## Main functionalities
- Payment reminders (single payment) — scheduled or manual
- Aggregated payment reminders (multiple payments per recipient) — opt-in via `notifications.aggregateReminders`
- Admin confirmation requests — fired when a member self-confirms
- Price-change announcements + member added/removed notices
- Channel preference resolution per user (email + telegram toggles, fallback chain)
- Email-params snapshot per `Notification` for activity-feed preview replay
- Telegram callback handlers for `confirm:`, `paydetails:`, `snooze:`, `admin_confirm:`, `admin_reject:`
- Activity feed and per-notification email preview rebuild

## Code map

### Service layer
- [src/lib/notifications/service.ts](src/lib/notifications/service.ts) — `sendNotification()` channel dispatch
- [src/lib/notifications/admin-nudge.ts](src/lib/notifications/admin-nudge.ts) — `sendAdminConfirmationNudge()`
- [src/lib/notifications/reminder-send.ts](src/lib/notifications/reminder-send.ts) — `sendReminderForPayment()`
- [src/lib/notifications/aggregated-reminder-send.ts](src/lib/notifications/aggregated-reminder-send.ts) — `sendAggregatedReminder()`
- [src/lib/notifications/reminder-targeting.ts](src/lib/notifications/reminder-targeting.ts) — eligibility + recipient resolution

### Email
- [src/lib/email/client.ts](src/lib/email/client.ts) — Resend wrapper
- [src/lib/email/templates/payment-reminder.ts](src/lib/email/templates/payment-reminder.ts)
- [src/lib/email/templates/admin-follow-up.ts](src/lib/email/templates/admin-follow-up.ts) — also exports `buildAdminFollowUpTelegramText()`
- [src/lib/email/templates/price-change.ts](src/lib/email/templates/price-change.ts), [price-adjustment.ts](src/lib/email/templates/price-adjustment.ts), [group-invite.ts](src/lib/email/templates/group-invite.ts)

### Telegram
- [src/lib/telegram/bot.ts](src/lib/telegram/bot.ts) — singleton bot
- [src/lib/telegram/handlers.ts](src/lib/telegram/handlers.ts) — callback dispatch (`handleMemberConfirm`, `handleAdminConfirm`, `handleAdminReject`)
- [src/lib/telegram/send.ts](src/lib/telegram/send.ts) — `sendAdminConfirmationRequest()` and friends
- [src/lib/telegram/keyboards.ts](src/lib/telegram/keyboards.ts) — `adminVerificationKeyboard()` (defined but currently *unused* by `sendAdminConfirmationNudge`)
- [src/lib/telegram/polling.ts](src/lib/telegram/polling.ts) — local-mode polling

### API routes
- [src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts](src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts) — enqueues `admin_confirmation_request`
- [src/app/api/confirm/[token]/route.ts](src/app/api/confirm/[token]/route.ts) — email "I paid" entry → enqueues admin nudge
- [src/app/api/dashboard/notify-unpaid/route.ts](src/app/api/dashboard/notify-unpaid/route.ts) — manual aggregated reminders, no queue
- [src/app/api/groups/[groupId]/notifications/route.ts](src/app/api/groups/[groupId]/notifications/route.ts) — toggles + `saveEmailParams`
- [src/app/api/activity/route.ts](src/app/api/activity/route.ts), [activity/notifications/[notificationId]/email/route.ts](src/app/api/activity/notifications/[notificationId]/email/route.ts)

### UI
- [src/app/(dashboard)/dashboard/notifications/](src/app/(dashboard)/dashboard/notifications) — notifications hub + per-type preview
- [src/app/(dashboard)/dashboard/activity/](src/app/(dashboard)/dashboard/activity) — activity feed
- [src/app/(dashboard)/dashboard/scheduled-tasks/](src/app/(dashboard)/dashboard/scheduled-tasks) — admin queue management

## Key entrypoints
1. [src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts:142](src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts:142) — enqueues admin nudge
2. [src/lib/tasks/worker.ts:18](src/lib/tasks/worker.ts:18) — task-type dispatch (calls `sendAdminConfirmationNudge` for `admin_confirmation_request`)
3. [src/lib/notifications/admin-nudge.ts:20](src/lib/notifications/admin-nudge.ts:20) — `sendAdminConfirmationNudge()` (currently builds *text-only* Telegram, no keyboard)
4. [src/lib/telegram/handlers.ts:255](src/lib/telegram/handlers.ts:255) — `handleAdminConfirm()` (wired and ready)
5. [src/jobs/enqueue-reminders.ts](src/jobs/enqueue-reminders.ts) — daily producer of `payment_reminder` / `aggregated_payment_reminder`

## Module-specific conventions
- **Channel preference**: per-user `notificationPreferences.email` (default true) + `.telegram` (default false). Admin nudge prefers Telegram when `chatId && botEnabled`, else email.
- **Aggregation key**: linked user → email → memberId fallback; one task per recipient per day.
- **Callback_data prefixes** (≤64 bytes): `confirm:<periodId>:<memberId>`, `paydetails:<periodId>:<memberId>`, `snooze:<periodId>:<memberId>`, `admin_confirm:<periodId>:<memberId>`, `admin_reject:<periodId>:<memberId>`.
- **Idempotency keys** (in `src/lib/tasks/idempotency.ts`):
  - `payment_reminder:<periodId>:<paymentId>:<day>`
  - `aggregated_payment_reminder:<recipientKey>:<day>`
  - `admin_confirmation_request:<groupId>:<periodId>:<day>`
- **Email-params snapshot**: when `group.notifications.saveEmailParams` is on, every `Notification` row stores the template name + builder args so `/api/activity/notifications/<id>/email` can re-render the exact HTML.

## Cross-cutting
- **Scheduled task types**: only three in production — `payment_reminder`, `aggregated_payment_reminder`, `admin_confirmation_request`
- **Audit events**: `payment_self_confirmed` from `self-confirm/route.ts:152`
- **Settings keys**: `notifications.email` (Resend API key), `notifications.telegram.botToken`, `notifications.aggregateReminders`, `general.appUrl`

## Gotchas
- **Admin Telegram nudge has no inline keyboard today.** `sendAdminConfirmationNudge()` builds plain text via `buildAdminFollowUpTelegramText()`. The `adminVerificationKeyboard()` helper *and* the `admin_confirm:` / `admin_reject:` handlers are wired, but nothing currently constructs and passes the keyboard. This is the gap to close when "admin sees who declared paid + button to confirm" is requested.
- The current admin nudge text lists `unverifiedMembers` (nickname + amount) but does **not** include the `memberConfirmedAt` timestamp — the template params don't carry it.
- Because the admin nudge dedupes by `(groupId, periodId, day)`, multiple member confirmations within one day produce **one** message — buttons would need to encode per-payment IDs to action each one individually.
- Manual `/api/dashboard/notify-unpaid` ignores grace period; cron honors it. Different eligibility checks live in `getReminderEligibility()`.
- Telegram message size: keep templates short — long messages plus inline keyboards can exceed limits or get truncated.

## Related modules
- `see-ref-billing` — payment lifecycle is the source of truth
- `see-ref-jobs` — queue producer + worker run from cron
- `see-ref-groups` — `notifications.*` toggles per group, `saveEmailParams` flag

## Updating this ref
When the admin-confirm Telegram keyboard finally lands, update the Gotchas section to "now sends inline buttons" and link the relevant lines.
