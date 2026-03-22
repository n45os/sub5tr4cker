# Changelog

All notable changes to this project will be documented in this file.

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
