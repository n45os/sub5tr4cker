# Research: sub5tr4cker — Minimal Local-First SubsTrack

> research conducted on 2026-03-26

## Similar Solutions / Prior Art

### PM2 (Process Manager)
- **URL**: https://pm2.keymetrics.io/
- **What it does**: Node.js process manager with CLI wizard, daemon mode, cron-like scheduling
- **Relevant takeaway**: their `pm2 startup` command is the gold standard for cross-platform service installation — detects OS, generates the exact command, asks user to confirm. We should follow this pattern for `s54r cron-install`.

### Plausible Analytics (Self-Hosted)
- **URL**: https://plausible.io/self-hosted-web-analytics
- **What it does**: privacy-first analytics with a self-hosted option (Docker-based)
- **Relevant takeaway**: their self-hosted setup is still heavy (Docker + PostgreSQL). SubsTrack's minimal mode is differentiated by being truly zero-dependency beyond Node.js.

### Actual Budget
- **URL**: https://actualbudget.org/
- **What it does**: local-first personal finance app, can self-host or run locally, uses SQLite
- **Relevant takeaway**: great example of local-first architecture. they use SQLite for all storage, have export/import, and optional sync. their architecture proves SQLite is sufficient for financial/billing data at personal scale.

### OpenClaw Gateway
- **URL**: https://github.com/openclaw/openclaw
- **What it does**: personal AI agent gateway with multi-backend architecture
- **Relevant takeaway**: the storage adapter pattern and bootstrap file injection are directly applicable. see architecture.md for specific patterns borrowed.

### create-t3-app / create-next-app
- **URL**: https://create.t3.gg/
- **What it does**: scaffolding CLI tools that use interactive prompts to configure a new project
- **Relevant takeaway**: the wizard UX pattern — select options, confirm, scaffold — is exactly what `npx s54r` should feel like. they use @clack/prompts (t3) and inquirer (create-next-app).

## Technology Options

### CLI Wizard: @clack/prompts
- **Pros**: 4KB gzipped (80% smaller than inquirer), beautiful UI out of the box, typed return values, explicit cancel handling via `isCancel()`, `group()` for chaining prompts, 7.1M weekly downloads
- **Cons**: less customizable than inquirer, fewer prompt types
- **Links**: https://www.npmjs.com/package/@clack/prompts
- **Decision**: use @clack/prompts — perfect fit for a setup wizard, modern API, tiny bundle

### Local Storage: better-sqlite3
- **Pros**: fastest Node.js SQLite library, synchronous API (simpler code), full JSON support via `json()` and `json_set()`, single-file database, ACID transactions, zero configuration
- **Cons**: native binary (needs compilation or prebuilt), adds ~5MB to package size
- **Links**: https://github.com/WiseLibs/better-sqlite3
- **Decision**: use better-sqlite3 with a document-store pattern — tables with `id TEXT PRIMARY KEY, data JSON, created_at, updated_at` columns. this keeps the data shape close to MongoDB documents for easy migration.

### Cross-Platform Scheduling

#### Linux: user-level crontab
- no sudo needed, `crontab -e` adds the entry
- command: `*/30 * * * * /usr/local/bin/s54r notify`
- most reliable, battle-tested

#### macOS: user-level launchd
- plist file in `~/Library/LaunchAgents/com.sub5tr4cker.notify.plist`
- no sudo needed, runs as current user
- more reliable than crontab on macOS (survives sleep/wake)

#### Windows: Task Scheduler
- can be created via `schtasks /create` PowerShell command
- or via the `windows-scheduler` npm package (wraps schtasks)
- alternative: recommend WSL and use Linux crontab approach
- **Links**: https://www.npmjs.com/package/windows-scheduler

### npm Package Name Availability
- `sub5tr4cker` — **available** (404 on registry.npmjs.org, confirmed 2026-03-26)
- `s54r` — **available** (404 on registry.npmjs.org, confirmed 2026-03-26)

## Key Findings

- @clack/prompts is the consensus best CLI prompt library in 2026, 80% smaller than inquirer with better DX — source: dev.to guide + npm stats
- better-sqlite3's `json()` function and JSON column type enable a document-store pattern that maps cleanly to MongoDB's document model — source: GitHub gist by vedantroy
- macOS launchd is more reliable than crontab for scheduled tasks (survives sleep/wake cycles) — source: Apple developer documentation
- Windows Task Scheduler can be automated via `schtasks /create` without admin rights for user-level tasks — source: windows-scheduler npm package
- Actual Budget (actualbudget.org) proves that SQLite is a viable storage engine for billing/financial tracking in local-first apps — source: their open-source repo

## Raw Links

- https://www.npmjs.com/package/@clack/prompts — CLI wizard library
- https://github.com/WiseLibs/better-sqlite3 — SQLite for Node.js
- https://gist.github.com/vedantroy/df6b18fa89bc24acfe89fc8493743378 — SQLite document store pattern
- https://www.npmjs.com/package/windows-scheduler — Windows Task Scheduler wrapper
- https://hexagon.github.io/croner/ — cross-platform in-process cron (alternative approach)
- https://actualbudget.org/ — local-first finance app reference architecture
- https://pm2.keymetrics.io/ — PM2's `startup` command as UX reference for cron installation
