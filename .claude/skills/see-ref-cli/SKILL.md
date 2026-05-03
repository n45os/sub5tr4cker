---
name: see-ref-cli
description: Reference for the s54r CLI — local-mode launcher, setup, cron install. Load explicitly when working on the CLI.
---

# s54r CLI module reference

## Purpose
`s54r` is the Commander-based CLI shipped with sub5tr4cker for **local-mode** deployments. It owns the local lifecycle: interactive setup, server startup, notification dispatch, OS-level cron install, and data export/import/migrate.

## Main functionalities
- `init` — guided setup: SQLite db, notification channels, admin account
- `start` — launches Next on `localhost:3054`; runs `next start` from repo root (better-sqlite3 binding requirement); starts Telegram polling
- `notify` — cron-friendly: poll Telegram, enqueue due reminders, run worker, exit
- `export` / `import [--dry-run]` — JSON bundle round-trip
- `migrate` — SQLite → MongoDB upgrade (switches mode)
- `cron-install` / `uninstall` — launchd/crontab/Task Scheduler
- `setup`, `configure`, `plugin add/remove/list` — advanced-mode helpers

## Code map
- [src/cli/index.ts](src/cli/index.ts) — Commander program + command registrations
- [src/cli/commands/local/init.ts](src/cli/commands/local/init.ts) — setup wizard
- [src/cli/commands/local/start.ts](src/cli/commands/local/start.ts) — server launcher (native vs standalone fallback)
- [src/cli/commands/local/notify.ts](src/cli/commands/local/notify.ts) — cron one-shot
- [src/cli/commands/local/cron-install.ts](src/cli/commands/local/cron-install.ts) — OS detection + scheduler integration
- [src/cli/commands/local/export-import.ts](src/cli/commands/local/export-import.ts)
- [src/lib/config/manager.ts](src/lib/config/manager.ts) — `~/.sub5tr4cker/config.json` read/write (perms `0o600` / dir `0o700`)
- [tsup.config.ts](tsup.config.ts) — bundles to `dist/cli/index.js`

### Build pipeline (from package.json)
- `build:cli` — tsup
- `build:standalone` — `next build` + `scripts/copy-standalone-assets.js`
- `build:all` — both (run by `prepublishOnly`)

## Key entrypoints
1. [src/cli/index.ts:33](src/cli/index.ts:33) — `main()` + command registration
2. [src/cli/commands/local/start.ts:8](src/cli/commands/local/start.ts:8) — `runStartCommand()` (env, native-vs-standalone decision)
3. [src/cli/commands/local/notify.ts:11](src/cli/commands/local/notify.ts:11) — adapter init → poll → enqueue → worker
4. [src/lib/config/manager.ts:6](src/lib/config/manager.ts:6) — `getDataDir()` / `getDbPath()` (`SUB5TR4CKER_DATA_PATH` override)
5. [src/lib/storage/index.ts:12](src/lib/storage/index.ts:12) — `getAdapter()` mode dispatch
6. [src/cli/commands/local/cron-install.ts:74](src/cli/commands/local/cron-install.ts:74) — `installCrontab()`

## Module-specific conventions
- **Standalone vs native binding**: `s54r start` prefers `next start` from the repo root because `.next/standalone/server.js` cannot resolve the compiled `better-sqlite3` `.node`. Falls back only if `next` binary is missing.
- **Env vars set by CLI**: `SUB5TR4CKER_MODE=local`, `SUB5TR4CKER_DATA_PATH`, `SUB5TR4CKER_AUTH_TOKEN` (doubles as `AUTH_SECRET` fallback), `PORT`, `HOSTNAME`, `NEXTAUTH_URL`.
- **Config cache**: `_cachedConfig` singleton; tests use `clearConfigCache()`.
- **Polling lock**: PID file `telegram-polling.lock` so `s54r start` (long-poll) and cron `s54r notify` (one-shot) never both poll.
- **OS cron**: macOS → launchd plist; Linux → crontab; Windows → Task Scheduler instructions printed.

## Cross-cutting
- Storage (SQLite + Mongoose factory)
- Config manager (bridges settings service in local mode)
- Telegram polling
- Jobs (worker invocation from `notify`)

## Gotchas
- **Native binding errors** (`Could not locate the bindings file`) — `pnpm install` then `pnpm build:standalone` (or `s54r init`).
- **SQLite lock under concurrent polling+cron** — mostly mitigated by the PID lock, but heavy windows can collide.
- **pnpm assumed everywhere.** Mixing npm in the same branch breaks workspace + alias resolution.
- **Mode default = advanced.** If `SUB5TR4CKER_MODE` is unset and config.json is missing, the app tries Mongo and fails — surface a setup hint.
- **Config cache vs external writes**: external edits to `config.json` won't be picked up without `clearConfigCache()`. In production, only the CLI writes it.

## Related modules
- `see-ref-storage` — both adapters live behind `db()`
- `see-ref-jobs` — `notify` runs the worker
- `see-ref-auth` — local mode auth token persisted in config.json

## Updating this ref
If a new local command lands, add it under "Main functionalities" and link its file in the code map.
