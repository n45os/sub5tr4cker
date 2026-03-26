# Risks: sub5tr4cker — Minimal Local-First SubsTrack

## High Risk

### Maintaining Two Storage Adapters Long-Term
- **What could go wrong**: every new feature needs to be implemented in both SQLite and Mongoose adapters. over time, they drift — one gets a bug fix the other doesn't, or a new query pattern works in MongoDB but is awkward in SQLite. maintenance burden doubles.
- **Likelihood**: high
- **Impact**: high
- **Mitigation**: write adapter conformance tests that run the same test suite against both implementations. every PR that touches data access must pass both. keep the adapter interface narrow — resist adding storage-specific escape hatches. consider generating the SQLite adapter from the Mongoose schemas if patterns emerge.

### Bundling Pre-Built Next.js in npm Package
- **What could go wrong**: the npm package becomes very large (50-100MB+) with the built Next.js app + better-sqlite3 native binaries. npm has a 100MB tarball limit. native binaries may not work across all Node.js versions or OS architectures (ARM vs x86). users on uncommon platforms can't install.
- **Likelihood**: medium
- **Impact**: high
- **Mitigation**: use `prebuild-install` for better-sqlite3 to download platform-specific binaries at install time. explore `next export` (static export) if possible to reduce bundle size. consider splitting into `@sub5tr4cker/core` + `@sub5tr4cker/cli` packages. test size early in development — if >50MB, restructure.

### SQLite ↔ MongoDB Data Fidelity During Migration
- **What could go wrong**: subtle differences between how SQLite and MongoDB handle dates, ObjectIds, nested arrays, and null values cause data corruption during migration. billing amounts don't match, payment statuses get lost, member references break.
- **Likelihood**: medium
- **Impact**: high
- **Mitigation**: use the universal JSON format as the migration bridge — both adapters serialize to the same schema. write comprehensive round-trip tests: create data in SQLite → export → import to MongoDB → export → compare with original. pay special attention to date serialization (ISO strings), ID references (nanoid vs ObjectId), and embedded arrays (member payments).

## Medium Risk

### Windows Support Gaps
- **What could go wrong**: better-sqlite3 native builds fail on Windows. launchd/crontab don't exist. Task Scheduler automation via PowerShell requires different privilege levels. path separators, file permissions, and shell differences cause unexpected failures.
- **Likelihood**: medium
- **Impact**: medium
- **Mitigation**: test on Windows in CI from day one. use `path.join()` everywhere, never hardcode `/`. for better-sqlite3, rely on prebuild-install which has Windows prebuilts. for cron, clearly document the Windows path as "manual" with copy-paste PowerShell commands rather than trying to automate everything. consider recommending WSL for the best experience.

### Telegram Polling Reliability in Cron Mode
- **What could go wrong**: the `s54r notify` script runs for 2-3 seconds via cron. Telegram `getUpdates` might miss callbacks that arrived between cron ticks (e.g., member pressed "I paid" at minute 15, cron runs at minute 0 and minute 30). the 15-minute gap means the callback sits unprocessed.
- **Likelihood**: medium
- **Impact**: medium
- **Mitigation**: store the last processed `update_id` in config/database. each `s54r notify` run calls `getUpdates` with `offset = lastUpdateId + 1` to pick up everything since the last check. Telegram stores unconfirmed updates for 24 hours, so nothing is lost between cron ticks. also: process callbacks at the start of each notify run, before sending new reminders.

### Feature Parity Confusion
- **What could go wrong**: users start with local mode, love it, want to upgrade to advanced — but discover features they expected (Stripe payments, member portal, multi-admin) don't exist yet or work differently. the "upgrade" path is unclear or disappointing.
- **Likelihood**: medium
- **Impact**: medium
- **Mitigation**: be very clear in the docs and CLI about what local mode includes and doesn't include. the init wizard should mention: "Local mode includes: groups, billing, notifications, history, export. For multi-user auth, member portal, and Stripe: upgrade to advanced mode with `s54r migrate`." the web UI settings page should have a clear "Upgrade to Advanced" section listing what you gain.

### Config File Corruption or Accidental Deletion
- **What could go wrong**: user manually edits `config.json` and introduces invalid JSON. or they accidentally delete `~/.sub5tr4cker/`. or a failed migration leaves the config in a half-updated state.
- **Likelihood**: low
- **Impact**: medium
- **Mitigation**: validate config with Zod on every read — if invalid, show a clear error and offer to re-run init. keep a `config.json.backup` that's updated before any migration/config change. the `s54r` CLI should detect missing data directory and offer to re-init. SQLite's WAL mode provides crash recovery for the database itself.

## Low Risk

### npm Package Name Squatting
- **What could go wrong**: someone registers `sub5tr4cker` or `s54r` on npm before we publish.
- **Likelihood**: low
- **Impact**: medium
- **Mitigation**: register both names early with a placeholder publish (`npm publish` with a minimal package.json). can be done immediately, costs nothing. alternatively, use `@substrack/cli` as a scoped fallback if the unscoped names are taken.

### Port 3054 Conflict
- **What could go wrong**: another service already uses port 3054 on the user's machine.
- **Likelihood**: low
- **Impact**: low
- **Mitigation**: detect port-in-use on startup, offer to use a different port, save the override in config. show a clear error message: "Port 3054 is in use. Run `s54r start --port 3055` or update your config."

### Auth Token Exposure
- **What could go wrong**: the auto-generated auth token in `config.json` is readable by any process on the machine. if the user accidentally exposes port 3054 to their network, anyone could access the dashboard.
- **Likelihood**: low
- **Impact**: low
- **Mitigation**: set `config.json` file permissions to `0600` (owner-only read/write). bind the web server to `127.0.0.1` only by default (not `0.0.0.0`). print a warning if the user explicitly binds to a public interface.

## Unknowns

- exact npm package size after bundling Next.js build + better-sqlite3 — needs early measurement during phase 8
- whether `next start` can be made to start fast enough (<2s) for a good UX, or if we need a lighter HTTP server
- how Telegram long-polling behaves when called from a short-lived cron script (needs testing with real bot)
- whether there's demand for a Docker-based minimal mode (SQLite inside a container) vs. bare-metal only
- pricing/limits of Resend free tier for users who manage many groups with many members
- how to handle schema migrations in SQLite when the app updates (new fields, changed structure) — need a migration strategy similar to what better-sqlite3 users typically implement
