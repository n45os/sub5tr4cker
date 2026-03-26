# Decisions: sub5tr4cker — Minimal Local-First SubsTrack

Decision log from brainstorming and planning sessions. Newest entries at the top.

---

## 2026-03-26 — Follow-up Clarifications

### Q: Should the wizard let users create the first group in the terminal?
**A**: no — group creation and management happens in the web UI. a TUI for group management is a future addition.
**Impact**: the wizard scope is limited to: notification channel setup → config → launch web UI. group CRUD is web-only for now.

### Q: Does the export schema need to be forward-compatible?
**A**: yes, obviously.
**Impact**: the `ExportBundle` JSON schema must be versioned. new fields get sensible defaults on import, removed/unknown fields are ignored. this means the schema design must be conservative — avoid breaking changes to existing fields.

### Q: Should `s54r start` run in foreground or as a daemon?
**A**: foreground by default. daemon mode can be added later as a `--daemon` flag.
**Impact**: `s54r start` occupies the terminal, Ctrl+C stops it. this is simpler and more transparent for a local tool. the cron-based `s54r notify` runs independently and doesn't need the web server at all.

### Q: Are there licensing concerns with better-sqlite3?
**A**: no — it's MIT licensed. the native binary distribution is a packaging concern (handled by `prebuild-install`), not a legal one. non-issue.
**Impact**: removed from risks. only packaging/size is a concern (measured in phase 8).

---

## 2026-03-26 — Initial Brainstorm

### Q: Where should the local data live?
**A**: `~/.sub5tr4cker/` — single global install, data persists even if the project folder is deleted.
**Impact**: all CLI commands reference this fixed path. the config file, SQLite database, and logs all live here. no scattered files across the filesystem.

### Q: What storage engine for local mode?
**A**: wanted something as close to MongoDB's document model as possible, so migration between local and advanced mode is clean. considered SQLite, JSON files, and lowdb. decided on SQLite with JSON columns via `better-sqlite3` — this gives us real SQL for queries plus document-like flexibility via JSON columns. the data shape stays close to MongoDB documents.
**Impact**: chose a hybrid approach — tables with `id, data JSON, created_at, updated_at` columns. the `data` column stores the full document as JSON, with extracted fields for indexed queries. this makes export/import between SQLite and MongoDB straightforward since both store the same JSON shape.

### Q: Should the local version still have a web UI?
**A**: yes — still serve a web UI on localhost. admin manages groups/billing in the browser after initial CLI setup.
**Impact**: the Next.js app is bundled inside the npm package as a pre-built production build. `s54r start` runs `next start` on port 3054. the web UI is the primary interface after initial setup.

### Q: How should the upgrade path from minimal to advanced work?
**A**: `s54r migrate` — one-time command that exports SQLite data and imports into MongoDB, then switches the config mode.
**Impact**: both adapters must implement the same `exportAll()` / `importAll()` methods producing identical JSON bundles. the migration is unidirectional (local → advanced) by default, but `export/import` works in both directions.

### Q: How should cron/scheduling work across OS types?
**A**: native OS scheduling — crontab on Linux, launchd on macOS. for Windows, suggest Task Scheduler via PowerShell. the app does NOT auto-install anything — it proposes the exact command and asks for explicit user permission.
**Impact**: `s54r cron-install` detects the OS, generates the appropriate command/config, shows it to the user, and asks "Proceed? [Y/n]". for Windows, it may need to generate a `.ps1` script or print manual instructions.

### Q: What should the npm package structure be?
**A**: `npx s54r` for first-time setup (no global install needed), then recommend `npm install -g sub5tr4cker` for ongoing use with cron. the CLI binary is `s54r`.
**Impact**: package.json has `"bin": { "s54r": "./dist/cli.js" }`, package name is `sub5tr4cker`. the global install gives a stable PATH entry for cron to reference.

### Q: How should auth work in local single-user mode?
**A**: auto-generated token stored in `config.json`. browser gets a cookie on first visit, transparent to user. no login page in local mode.
**Impact**: the auth middleware has two paths — in local mode, check the token cookie against config; in advanced mode, use Auth.js sessions. no User model needed in local mode.

### Q: Which features should the minimal version include?
**A**: groups, billing periods, payment tracking, notifications (email + Telegram), basic payment history, export/import. Telegram gets full interactive flow (including "I paid" confirmations) since it works via polling without needing a public URL. email is notification-only (send reminders, no confirmation links since they'd point to localhost).
**Impact**: the feature set is nearly complete — the main omissions are member self-service portal, multi-user auth, Stripe integration, and advanced analytics. the confirmation flow works for Telegram in local mode because the bot polls for updates rather than requiring a webhook.

### Q: Should the member page exist in local mode?
**A**: no — local mode is admin-only. members don't have access to the web UI. they receive notifications (email or Telegram) and can confirm payments via Telegram only.
**Impact**: member-facing routes/pages are feature-flagged off in local mode. the admin dashboard is the only web interface. for Telegram, the bot uses long-polling (`getUpdates`) instead of webhooks.

### Q: What notification channels should be supported, and how extensible?
**A**: email (Resend) and Telegram for now. no specific future channels yet, but the system should be extensible for whatever comes (WhatsApp, Discord, SMS, push, etc.)
**Impact**: designed a `NotificationChannel` interface with `send()`, `canConfirm()`, `handleCallback()`. new channels implement this interface and register in the channel registry. the CLI wizard dynamically shows available channels.

### Q: What happens with cron on Windows?
**A**: propose Windows Task Scheduler via a PowerShell command. don't want to add things at system level without warnings — the app should produce warnings for the user to accept.
**Impact**: on Windows, `s54r cron-install` generates a PowerShell one-liner for `schtasks /create` and clearly explains what it does before asking permission. may also suggest WSL as an alternative.

### Q: What about the npm package name?
**A**: package name `sub5tr4cker`, CLI binary `s54r`. both confirmed available on npm registry (404 as of 2026-03-26).
**Impact**: registered names — `sub5tr4cker` for the npm package, `s54r` as the bin alias. the data directory uses the package name: `~/.sub5tr4cker/`.

### Q: Should there be an uninstall flow?
**A**: yes — `s54r uninstall` that first asks if they want a backup export, then removes the data directory and any installed cron entries.
**Impact**: the uninstall command is a multi-step process: offer backup → export if accepted → confirm deletion → remove cron entries → delete `~/.sub5tr4cker/` → print post-uninstall instructions for removing the global npm package.

### Q: What port should the web UI use?
**A**: 3054.
**Impact**: hardcoded as default in config, overridable via config.json or environment variable.

### Alternatives Considered

- **NeDB / @seald-io/nedb**: MongoDB-compatible embedded database — rejected because poorly maintained, would couple us to a dying abstraction
- **TingoDB**: another MongoDB-compatible file DB — rejected, same maintenance concerns
- **lowdb**: JSON file with lodash queries — rejected, too limited for complex queries (billing period lookups, date ranges), no real indexing
- **Plain JSON files**: zero-dependency but fragile with concurrent access, no query engine, bad for anything beyond tiny datasets
- **FerretDB**: MongoDB-compatible proxy over SQLite/Postgres — rejected, requires running a separate process, too heavy for "minimal"
- **mongodb-memory-server**: in-memory MongoDB for testing — rejected, not designed for persistent storage
- **inquirer.js**: CLI prompts — rejected in favor of @clack/prompts (smaller, better UX, modern API)
- **Background daemon (node-cron)**: keep a Node process running for notifications — rejected in favor of OS-native cron, lighter and more reliable
- **npx-only (no global install)**: using npx for cron execution — rejected because npx re-resolves the package on each invocation, adding 5-10s overhead per cron tick

### Key Decisions Made

1. **Storage adapter pattern** — because it cleanly separates business logic from storage, enables both SQLite and MongoDB, and makes migration/export trivial
2. **SQLite with JSON columns** — because it's the closest to MongoDB's document model while being embedded and zero-config, and `better-sqlite3` is rock-solid
3. **@clack/prompts for CLI wizard** — because it's modern, tiny, beautiful, and the consensus best choice for 2026
4. **OS-native cron with explicit permission** — because it's more reliable than a background Node daemon, survives reboots, and respects the user's system
5. **Global npm install for ongoing use** — because it gives cron a stable binary path that auto-updates with `npm update -g`
6. **Telegram polling instead of webhooks for local mode** — because polling works without a public URL, enabling full interactive flow (including "I paid" confirmations) on localhost
7. **No User model in local mode** — because there's only one user (the admin), simplifying the entire auth and data layer
8. **Universal JSON export format** — because it enables data portability between local and advanced modes, backup/restore, and future platform migrations
9. **Pre-built Next.js bundled in npm package** — because users shouldn't need to build the app themselves, `s54r start` should just work
