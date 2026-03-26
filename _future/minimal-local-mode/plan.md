# Implementation Plan: sub5tr4cker — Minimal Local-First SubsTrack

## Phase 1: Storage Adapter Layer — ~3-4 days

### Goal
Extract all data access from the existing codebase into a `StorageAdapter` interface, and implement the Mongoose adapter as a thin wrapper. This is the foundation — nothing else works without it.

### Tasks
- [ ] define `StorageAdapter` TypeScript interface with all CRUD methods (groups, billing periods, notifications, scheduled tasks)
- [ ] define universal data types (`GroupData`, `BillingPeriodData`, etc.) that are storage-agnostic (no ObjectId, no Mongoose types)
- [ ] implement `MongooseAdapter` that wraps existing models behind the interface
- [ ] create `AdapterFactory` that reads config and returns the appropriate adapter
- [ ] refactor all API routes to use `getAdapter()` instead of importing models directly
- [ ] refactor all job/cron code to use the adapter
- [ ] ensure existing tests pass with the Mongoose adapter

### Deliverables
- working `StorageAdapter` interface
- `MongooseAdapter` implementation passing all existing tests
- all API routes and jobs using the adapter layer
- no behavioral changes to the existing app

---

## Phase 2: SQLite Adapter — ~2-3 days

### Goal
Implement the SQLite storage backend so the app can run without MongoDB.

### Tasks
- [ ] add `better-sqlite3` dependency
- [ ] implement `SqliteAdapter` conforming to `StorageAdapter` interface
- [ ] create SQLite schema (tables with JSON columns, indexes)
- [ ] implement ID generation (nanoid) since there's no ObjectId
- [ ] implement JSON serialization/deserialization matching the universal data types
- [ ] add SQLite-specific query optimizations (json_extract for indexed lookups)
- [ ] write adapter tests that run the same test suite against both SQLite and Mongoose adapters
- [ ] handle SQLite file creation, WAL mode, connection lifecycle

### Deliverables
- `SqliteAdapter` passing the full adapter test suite
- the app can run against SQLite with all core features working

---

## Phase 3: CLI Tool + Init Wizard — ~2-3 days

### Goal
The `npx s54r` experience — a user runs one command and gets a configured, running instance.

### Tasks
- [ ] set up npm package structure (`sub5tr4cker` package, `s54r` bin entry)
- [ ] implement CLI framework with subcommands: `init`, `start`, `stop`, `notify`, `export`, `import`, `migrate`, `cron-install`, `uninstall`
- [ ] build init wizard with @clack/prompts:
  - welcome screen with ASCII art / branding
  - select notification channel(s): email, Telegram, or both
  - if email: collect Resend API key, from address, send test email
  - if Telegram: collect bot token, verify bot exists, explain how users link their Telegram
  - confirm settings summary
- [ ] create `~/.sub5tr4cker/` directory with `config.json`, initialize SQLite database
- [ ] generate auth token, store in config
- [ ] implement `s54r start` — launches `next start` on port 3054, opens browser
- [ ] implement `s54r stop` — kills the running Next.js process

### Deliverables
- working `npx s54r` flow from zero to running dashboard
- all CLI subcommands stubbed (full implementation in later phases)

---

## Phase 4: Local Auth + Web UI Adaptation — ~2 days

### Goal
The existing web UI works in local single-user mode without Auth.js.

### Tasks
- [ ] create local auth middleware: reads token from cookie, validates against config
- [ ] create `AuthProvider` abstraction: Auth.js for advanced mode, token-cookie for local mode
- [ ] feature-flag member-facing pages/routes (hide in local mode)
- [ ] hide user registration / login pages in local mode
- [ ] adapt the dashboard to show "local mode" indicator
- [ ] add settings page sections for: export data, import data, backup, switch to advanced mode
- [ ] ensure all dashboard pages work with the SQLite adapter

### Deliverables
- web UI fully functional in local mode
- admin can manage groups, view billing, see history via browser

---

## Phase 5: Notification Channels (Local Mode) — ~2-3 days

### Goal
Email and Telegram notifications work from the local `s54r notify` command.

### Tasks
- [ ] implement `NotificationChannel` interface and channel registry
- [ ] implement `ResendChannel` — sends reminder emails, no confirmation links (local mode)
- [ ] implement `TelegramChannel` — sends reminders with "I paid" inline buttons
- [ ] implement Telegram polling mode (`getUpdates`) for local mode (currently webhook-only)
- [ ] implement `s54r notify` standalone script:
  - reads config
  - initializes SQLite adapter
  - queries open billing periods past grace
  - sends reminders via configured channels
  - polls Telegram for "I paid" callbacks, processes confirmations
  - logs notifications, exits
- [ ] test the full notification flow end-to-end (local SQLite + Resend + Telegram)

### Deliverables
- `s54r notify` sends reminders and processes Telegram confirmations
- complete notification cycle works without the web server running

---

## Phase 6: Cron Installation — ~1 day

### Goal
Users can set up automatic notification scheduling with one command.

### Tasks
- [ ] implement OS detection in `s54r cron-install`
- [ ] Linux: generate crontab entry, show to user, add on confirmation
- [ ] macOS: generate launchd plist for `~/Library/LaunchAgents/`, install on confirmation
- [ ] Windows: generate `schtasks /create` PowerShell command, show to user, optionally execute
- [ ] implement `s54r cron-uninstall` (used by uninstall flow)
- [ ] store cron state in config (installed, method, interval)
- [ ] add helpful error messages if cron fails (permissions, path issues)

### Deliverables
- `s54r cron-install` works on Linux and macOS
- Windows gets clear manual instructions
- `s54r cron-uninstall` cleanly removes entries

---

## Phase 7: Export / Import / Migrate — ~2 days

### Goal
Data portability between local and advanced modes, plus backup/restore.

### Tasks
- [ ] define `ExportBundle` JSON schema (versioned, with Zod validation)
- [ ] implement `exportAll()` on both adapters
- [ ] implement `importAll()` on both adapters (with conflict resolution: skip, overwrite, merge)
- [ ] implement `s54r export` CLI command (writes JSON file to specified path)
- [ ] implement `s54r import` CLI command (reads JSON file, validates, imports)
- [ ] implement `s54r migrate` CLI command:
  - collect MongoDB URI
  - test connection
  - export from SQLite
  - import to MongoDB
  - update config to advanced mode
- [ ] add export/import buttons to the web UI settings page
- [ ] implement `s54r uninstall` with backup prompt

### Deliverables
- full export/import cycle works between SQLite and MongoDB
- migration from local to advanced is a single command
- uninstall with optional backup works

---

## Phase 8: npm Packaging + Distribution — ~1-2 days

### Goal
The package is published on npm and `npx s54r` works for anyone.

### Tasks
- [ ] configure package.json for npm publishing (name, bin, files, engines)
- [ ] set up build pipeline: compile CLI + pre-build Next.js app into dist/
- [ ] handle native dependency (better-sqlite3) — use `optionalDependencies` or `prebuild-install`
- [ ] test on clean machines: macOS, Linux, Windows (via CI)
- [ ] write README for npm package page (installation, quick start, commands reference)
- [ ] set up GitHub release workflow that publishes to npm on version tags
- [ ] test the full `npx s54r` flow on a clean machine

### Deliverables
- `sub5tr4cker` published on npm
- `npx s54r` works on macOS, Linux, and Windows
- clean README on the npm package page

---

## Phase 9: Polish + Onboarding Skill — ~1 day

### Goal
The experience is smooth, and future changes to the onboarding flow are easy.

### Tasks
- [ ] create a Cursor skill (`.cursor/skills/onboarding-flow/SKILL.md`) that triggers when notification channels or setup flow changes — ensures the wizard stays in sync
- [ ] add ASCII art / branding to the CLI wizard
- [ ] add color and formatting to all CLI output
- [ ] improve error messages throughout (network failures, invalid tokens, port in use, etc.)
- [ ] test edge cases: re-running init on an existing install, corrupt config, missing database
- [ ] write user-facing documentation (quick start guide, FAQ, troubleshooting)

### Deliverables
- polished CLI experience
- onboarding skill registered in .cursor/
- user documentation

## Dependencies

- the existing SubsTrack codebase must be stable (no major refactors in parallel)
- Resend account for email testing
- Telegram bot for Telegram testing
- npm account for publishing
- CI/CD for cross-platform testing (GitHub Actions with macOS, Linux, Windows runners)

## Estimated Total Effort

~16-22 days of focused work, best done in 3-4 week sprints:
- Sprint 1 (week 1-2): phases 1-3 (foundation: adapter, SQLite, CLI)
- Sprint 2 (week 2-3): phases 4-6 (UI adaptation, notifications, cron)
- Sprint 3 (week 3-4): phases 7-9 (data portability, packaging, polish)

The adapter layer (phase 1) is the critical path — it unblocks everything else and also improves the existing codebase architecture regardless of whether the local mode ships.
