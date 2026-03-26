# sub5tr4cker — Minimal Local-First SubsTrack

- **slug**: minimal-local-mode
- **registered**: 2026-03-26
- **last updated**: 2026-03-26
- **status**: new
- **priority**: high
- **tags**: cli, npm, local-first, sqlite, developer-experience, onboarding

## Summary

Repackage SubsTrack as a self-contained npm CLI tool (`sub5tr4cker`, binary `s54r`) that anyone can install and run locally with a single command. The minimal version uses SQLite instead of MongoDB, stores everything in `~/.sub5tr4cker/`, and walks users through a terminal wizard to configure notification channels (email via Resend or Telegram). After setup it launches a Next.js production UI on `localhost:3054`. A standalone `s54r notify` script handles scheduled reminders without starting the web server. The architecture uses a storage adapter pattern so the same core logic can run against SQLite (local) or MongoDB (advanced/cloud), with a migration command to move between them and full export/import for data portability.

## Goal

A person types `npx s54r`, answers 3-5 wizard questions, and has a working subscription-tracking app running on their machine in under 2 minutes — no MongoDB, no Docker, no environment files.

## Scope

### In scope

- npm package `sub5tr4cker` with bin entry `s54r`
- interactive CLI wizard (`@clack/prompts`) for first-time setup
- SQLite storage adapter (via `better-sqlite3`) as the default local backend
- Mongoose/MongoDB storage adapter preserved for advanced/cloud mode
- shared core business logic layer both adapters use
- local web UI via `next start` on `localhost:3054`
- single-user local auth (auto-generated token cookie, no login page)
- notification channels: email (Resend, send-only) and Telegram (full interactive flow with "I paid" button via polling)
- standalone `s54r notify` command for cron-based notifications (no web server needed)
- `s54r cron-install` — OS-aware cron/launchd setup with explicit user permission
- `s54r export` / `s54r import` — universal JSON format, works across both storage backends
- `s54r migrate` — one-time SQLite → MongoDB migration
- `s54r uninstall` — prompts for backup, then removes data directory + cron entries
- data stored in `~/.sub5tr4cker/` (config, SQLite database, logs)
- minimal feature set: groups, billing periods, payment tracking, notifications, payment history, export/import

### Out of scope

- public-facing member portal (members interact via Telegram or receive email-only in local mode)
- multi-user auth / user registration in local mode
- Stripe payments integration in minimal mode
- Docker / containerized deployment (that's the existing advanced mode)
- mobile app or PWA
- analytics or reporting beyond basic payment history
- real-time features (websockets, live updates)

## Resolved Questions

- **group creation in wizard?** — no, groups are managed via the web UI. a terminal UI (TUI) for group management is a future addition.
- **export schema forward-compatibility** — required. the JSON export bundle must be versioned and forward-compatible as models evolve. new fields get defaults, removed fields are ignored on import.
- **foreground vs daemon?** — foreground by default (`s54r start` occupies the terminal, Ctrl+C stops it). daemon mode (`--daemon` flag) can be added later if requested.
- **better-sqlite3 licensing** — MIT licensed, no concerns. native binary distribution handled by `prebuild-install`.

## Open Questions

- Windows cron alternative: Task Scheduler via PowerShell script, or recommend WSL?
- exact versioning strategy for the export JSON schema (semver? monotonic integer?)
- npm package size after bundling pre-built Next.js + native deps — needs early measurement
