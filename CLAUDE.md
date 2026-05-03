# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Read AGENTS.md first

`AGENTS.md` at the repo root is the primary architecture document. It contains the full directory map, key file index, data model summary, and "common tasks" recipes (adding an API route, a notification type, a cron job). **Read it before starting non-trivial work.** The notes here are a Claude-specific supplement, not a replacement.

Other authoritative docs:
- `docs/PLAN.md` — full architecture, billing modes, payment confirmation flow
- `docs/data-models.md` — schema reference for every model
- `docs/api-design.md` — API route reference (includes lifecycle **Flows**)
- `_context/context.md` — current project state snapshot (kept in sync with releases)

## Commands

This project uses **pnpm** — never mix `npm` into the same branch.

| Command | Purpose |
|---|---|
| `pnpm dev` | Run Next.js dev server on port **3054** (advanced/MongoDB mode) |
| `pnpm build` | Next.js production build |
| `pnpm build:cli` | Build the `s54r` CLI via tsup |
| `pnpm build:standalone` | Build Next + copy standalone assets (used by `s54r init/start`) |
| `pnpm build:all` | Standalone + CLI (what `prepublishOnly` runs) |
| `pnpm start` | `next start` |
| `pnpm test` | Run vitest once |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test -- path/to/file.test.ts` | Run a single test file |
| `pnpm test -- -t "name"` | Run tests by name pattern |
| `pnpm lint` | ESLint |
| `pnpm cron` | Start node-cron runner (`src/jobs/runner.ts`) — billing periods, enqueue reminders/follow-ups, notification worker |
| `pnpm cron:billing` | One-shot: run `checkBillingPeriods()` |
| `pnpm cron:reminders` | One-shot: enqueue reminders + run notification worker |
| `pnpm seed` | `tsx scripts/seed.ts` |
| `pnpm setup` | First-time advanced-mode wizard (writes `.env.local`, seeds settings into Mongo) |
| `pnpm s54r <cmd>` | Run the CLI from source via tsx (e.g. `pnpm s54r notify`) |

Single-test invocation example: `pnpm test -- src/lib/billing/calculator.test.ts -t "equal split"`.

## Two operating modes — always check which one you're in

The same code runs against two storage backends, selected by `SUB5TR4CKER_MODE`:

| | **local** mode | **advanced** mode |
|---|---|---|
| Storage | SQLite (`~/.sub5tr4cker/data.db`) | MongoDB / Mongoose |
| Auth | Token cookie (auto-login, `src/lib/auth/local.ts`) | Auth.js v5 / NextAuth |
| Telegram | Polling (`src/lib/telegram/polling.ts`) | Webhook |
| Settings | `~/.sub5tr4cker/config.json` | `Settings` collection in Mongo |
| Entry | `s54r init` then `s54r start` | `pnpm setup` then `pnpm dev` |

**Implication for code changes:** API routes, cron jobs, the activity feed, the member portal, and grammy handlers must use the shared `StorageAdapter` via `const store = await db()` from `@/lib/storage`. **Never import Mongoose models directly in route handlers** — that breaks local mode. Adding a new data operation usually means adding a method to `StorageAdapter` (`src/lib/storage/adapter.ts`) and implementing it in both `mongoose-adapter.ts` and `sqlite-adapter.ts`.

The local-mode `s54r start` command runs `next start` from the repo root (not from `.next/standalone/server.js`) so the `better-sqlite3` native addon resolves. If you see "Could not locate the bindings file", run `pnpm install` then `pnpm build:standalone` (or `s54r init`).

## Architecture mental model

- **Group** is the central entity — a shared subscription with embedded members, billing config (`paymentInAdvanceDays`, billing mode), and payment method.
- **BillingPeriod** = one cycle per group per month, with per-member payment statuses (`pending → member_confirmed → confirmed`) and a `collectionOpensAt` timestamp used to query "open" periods.
- **Reminder pipeline = enqueue + worker.** Cron jobs in `src/jobs/` (e.g. `enqueue-reminders.ts`) create `ScheduledTask` rows; `src/lib/tasks/worker.ts` claims and executes them, **skipping any task whose underlying payment is no longer unpaid**. The only task types in production are `payment_reminder`, `aggregated_payment_reminder`, `admin_confirmation_request`. Manual "Notify unpaid" from the dashboard sends aggregated reminders **without** the queue.
- **Notifications dispatch** is unified in `src/lib/notifications/service.ts` and fans out to email (Resend, React Email templates in `src/lib/email/templates/`) and/or Telegram (grammy, helpers in `src/lib/telegram/send.ts`).
- **Confirmation links** in emails carry HMAC tokens generated/verified by `src/lib/tokens.ts`. Telegram confirmations come back through callback queries (see `src/lib/telegram/handlers.ts`).
- **Telegram-only members** are supported — member email is optional. Reminders group by linked user → email → member-id fallback so a Telegram-only member still gets one combined message.

## Conventions

From `.cursor/rules/` and `_context/conventions.md`:

- **Comments**: lowercase first letter, no trailing period (e.g. `// calculate member share`).
- **Files**: kebab-case (`billing-period.ts`); components PascalCase (`GroupCard.tsx`).
- **Exports**: named exports; default exports only for Next.js pages.
- **Imports**: `@/*` alias maps to `src/*`.
- **API responses**: `{ data }` on success, `{ error: { code, message, details? } }` on failure, standard HTTP status codes.
- **Validation**: Zod is the primary layer in route handlers; Mongoose validation is a second layer (advanced mode only).
- **Auth**: protected routes call `auth()` from `@/lib/auth` (works in both modes).
- **Cron routes**: gate with `await getSetting("security.cronSecret")` checked against the `x-cron-secret` header.
- **Mongoose models**: define interface, then schema, use the `mongoose.models.X || mongoose.model()` re-registration guard, `timestamps: true`, indexes via separate `.index()` calls. Re-export from `src/models/index.ts`.
- **Telegram**: we use **grammy** (not telegraf). Bot is a singleton in `src/lib/telegram/bot.ts`. Inline-keyboard `callback_data` is colon-delimited (`action:param1:param2`), max 64 bytes; common prefixes: `confirm:`, `paydetails:`, `admin_confirm:`, `admin_reject:`, `snooze:`.
- **Components**: shadcn/ui primitives in `src/components/ui/`; feature components grouped by domain in `src/components/features/<feature>/`. Server components by default — add `'use client'` only when needed.

## Troubleshooting guardrails (from .cursor/rules)

- `Cannot find native binding` for `@rolldown/binding-darwin-arm64` → reinstall with `pnpm install`, rerun pnpm scripts (don't fall back to npm).
- `MongoDBAdapter` type mismatch on `MongoClient` after a package-manager switch → keep a direct `mongodb@^6` dependency to satisfy the adapter peer.
- In strict-TS route files, explicitly type callback params on Mongoose array methods (`find`, `map`, `filter`, …) to avoid implicit `any`.
- Avoid very large inline object types in callback signatures inside route files — move them to a named `type` to dodge Turbopack parser errors like `Expected ',', got ';'`.

## Release workflow

After a substantial change, decide whether to bump the version:

- **patch (`0.x.y` → `0.x.(y+1)`)**: bug fix, safe polish, no new capability.
- **minor (`0.x.*` → `0.(x+1).0`)**: new non-breaking feature, endpoint, job, integration, or workflow.
- **major**: breaking API/schema change, required migration, or removed behavior.

Skip the bump for comments/copy/formatting/lint-only or refactor-with-no-behavior-change commits.

When bumping: update `package.json` version, the matching root version field in lockfiles, and add a dated section to `CHANGELOG.md`. Then sync `docs/`, `content/docs/`, and `_context/` against the new changelog entry (the workflow lives at `.cursor/skills/release-docs-sync/SKILL.md`). State the bump decision (or the explicit "no bump" decision) in your final response.
