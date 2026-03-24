# Changelog

All notable changes to this project will be documented in this file.

## [0.33.0] - 2026-03-24

### Added

- **Activity sent email preview** — Optional per-group `notifications.saveEmailParams` (default off). When enabled, structured template arguments for outgoing emails are stored on `Notification.emailParams`; Activity shows **View email** and `GET /api/activity/notifications/[notificationId]/email` rebuilds HTML via the same template builders. Group notifications panel includes the toggle; `GET /api/activity` notification items include `hasEmailParams`.

## [0.32.0] - 2026-03-24

### Added

- **Payment in advance** — Per-group `billing.paymentInAdvanceDays` (0–365): the billing period is created and unpaid tracking opens that many days before each renewal (cycle day). Each `BillingPeriod` stores `collectionOpensAt` (denormalized at creation). Automated reminders use **grace period from collection open** (first reminder when `now >= collectionOpensAt + gracePeriodDays`). Manual **Notify unpaid**, dashboard unpaid counts, cron `enqueue-reminders`, and `enqueue-follow-ups` use the same “collection window open” rule (`$expr` on `collectionOpensAt` with legacy fallback to `periodStart`). Pending → **overdue** (`reconcile-overdue`) stays anchored to **14 days after period start** (renewal). Run `pnpm tsx scripts/backfill-collection-opens-at.ts` once on existing databases to set `collectionOpensAt` on old periods (optional; queries already fall back for missing fields).

### Changed

- **Grace period semantics** — Documented and implemented as days after the collection window opens (not “after billing day” only). When `paymentInAdvanceDays` is 0, collection opens on the renewal day, matching previous behavior.

## [0.31.1] - 2026-03-24

### Fixed

- **Dashboard “groups needing attention”** — `GET /api/groups` `unpaidCount` and `GET /api/dashboard/quick-status` now use the same open-period aggregation (all relevant billing periods, not only the latest). Workspace pulse counts only groups you **own**. Quick status clarifies open follow-ups vs payment reminders; `groupsEligibleForReminders` matches bulk notify. Response adds `groupsNeedingAttention` and `groupsEligibleForReminders`; `groupsWithPendingOverdue` is kept as an alias of `groupsNeedingAttention` for compatibility.

## [0.31.0] - 2026-03-24

### Added

- **Documentation** — `docs/api-design.md` now documents product flows (billing, notification queue vs manual notify, member confirm paths), cron auth note (`x-cron-secret`), and additional routes (dashboard, activity, payments, user, plugins, health, unsubscribe, invite accept, member portal Telegram link). `docs/PLAN.md` includes a notification pipeline diagram.

### Changed

- **Dashboard UX** — Group actions: **Edit** stays visible; **Initialize**, **Import history**, and **Delete** moved under a **⋯** menu. Admin **Subscriptions you pay for** table uses a per-row **⋯** menu (Open / Delete). Header: removed duplicate **Create group** and non-interactive avatar strip; breadcrumbs include **Scheduled tasks**, **Payments**, group name (from sidebar data), and **Billing** on the billing sub-route. Settings **Notifications** tab groups test/register/check actions under **Quick actions**. **Scheduled tasks** bulk cancel and **Reject** payment (matrix) require confirmation; Telegram **Disconnect** confirms. Notifications panel on the group page defaults **expanded**. Billing-only page no longer duplicates import (use group page).
- **Payments summary** — Top cards show a single currency label when all rows match, or **mixed** when currencies differ (instead of hardcoded EUR).

### Fixed

- **Admin reject payment (HTTP)** — `POST .../billing/[periodId]/confirm` with `action: "reject"` now clears `memberConfirmedAt`, matching Telegram admin reject.

### Removed

- **Dead job** — Deleted unused `src/jobs/send-reminders.ts` (reminders use `enqueue-reminders` + worker).
- **Scheduled task types** — `price_change`, `invite`, and `follow_up` removed from `ScheduledTask` schema and filters (they were never enqueued; worker could not execute them). Existing MongoDB documents with those `type` values may need a one-off migration if any exist.

### Deprecated (API)

- JSDoc `@deprecated` on `GET .../notification-preview`, `GET /api/notifications/templates`, and `GET /api/notifications/templates/[type]/preview` — first-party UI uses template helpers directly.

## [0.30.0] - 2026-03-23

### Added

- **Scheduled tasks (admin)** — Dashboard page **Scheduled tasks** lists queued notification tasks for groups you administer; cancel pending/locked tasks, retry failed ones, or bulk-cancel by group id, member email (aggregated reminders), or task type. APIs: `GET /api/scheduled-tasks`, `PATCH /api/scheduled-tasks/[taskId]`, `POST /api/scheduled-tasks/bulk-cancel`.
- **`cancelled` status** on `ScheduledTask` plus `cancelledAt` for admin cancellations.

### Fixed

- **Reminder worker** — Skips sending when a payment is no longer `pending` or `overdue` at execution time (avoids reminders after a paid member was still queued).

### Changed

- **Dialog footers** — Clearer labels (e.g. close without notifying, skip without sending) and consistent button spacing (`gap-2` on desktop); removed redundant extra **Close** buttons where **Cancel** already dismisses.

## [0.29.0] - 2026-03-23

### Added

- **Delete group (UI)** — Admins can remove a group from the dashboard via the group header, the home **Subscriptions you pay for** admin table, or the **Danger zone** on the edit group screen (soft delete; existing `DELETE /api/groups/[groupId]`).
- **Admin services table on dashboard** — The home page shows a table of subscription groups you own (service, pricing, members, next cycle, unpaid attention) with Open and Delete actions.

## [0.28.0] - 2026-03-21

### Added

- **Group email themes with live preview** — Each group now supports a selectable notification style preset (`clean`, `minimal`, `bold`, `rounded`, `corporate`) in the group form, with a live reminder preview before saving.
- **Notification preview tooling** — Added a group-scoped notification preview API and a template-center theme switcher so admins can inspect template variants quickly.

### Changed

- **Template system redesign** — All core email templates now use a shared layout/theme shell for consistent structure, stronger hierarchy, and improved readability.
- **Payment-focused reminder UX** — Reminder emails now include payment method details (platform/link/instructions) and use “Verify payment” actions that route members to the member portal flow instead of instant confirmation links.
- **Member portal pay-link experience** — Member portal now supports deep links (`?pay=...&open=confirm`) to preselect a period and open the confirmation dialog directly from notifications.

## [0.27.0] - 2026-03-20

### Added

- **Telegram payment reminders** — Inline button **Show paying details** sends a follow-up message with the group’s payment platform, pay link, free-text instructions, and optional admin note (hidden on multi-group aggregated reminders where a single details block would be misleading).

## [0.26.3] - 2026-03-19

### Fixed

- **Aggregated reminder copy** — Combined payment reminders now count distinct billing periods and subscription groups instead of treating each period line as a separate “group” (email body, subject line, and Telegram intro).
