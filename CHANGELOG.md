# Changelog

All notable changes to this project will be documented in this file.

## [0.27.0] - 2026-03-20

### Added

- **Telegram payment reminders** — Inline button **Show paying details** sends a follow-up message with the group’s payment platform, pay link, free-text instructions, and optional admin note (hidden on multi-group aggregated reminders where a single details block would be misleading).

## [0.26.3] - 2026-03-19

### Fixed

- **Aggregated reminder copy** — Combined payment reminders now count distinct billing periods and subscription groups instead of treating each period line as a separate “group” (email body, subject line, and Telegram intro).
