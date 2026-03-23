# Changelog

All notable changes to this project will be documented in this file.

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
