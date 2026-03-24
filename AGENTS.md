# AGENTS.md — SubsTrack

## Project Overview

SubsTrack is an open-source web app for managing shared subscriptions. An admin pays for a service (YouTube Premium, Netflix, etc.) and splits the cost with members. The app automates reminders, tracks payments, and handles confirmations.

**Tech**: Next.js 15 (App Router), MongoDB/Mongoose, Auth.js v5, Resend (email), grammy (Telegram), node-cron, persisted notification task queue.

## Architecture

Read `docs/PLAN.md` for the full architecture. Key concepts:

- **Groups** — a shared subscription with an admin, members, and billing config
- **Billing periods** — monthly entries tracking who owes what
- **Payment flow** — pending → member_confirmed → confirmed (admin verifies)
- **Notification channels** — email (Resend) and Telegram (grammy)
- **Cron + task queue** — reconciliation jobs (billing periods, overdue state); notification delivery via enqueue + worker (ScheduledTask)

## Directory Map

```
src/
├── app/                    # pages and API routes (Next.js App Router)
│   ├── (auth)/             # auth pages (login, register)
│   ├── (dashboard)/        # protected pages (groups, settings, etc.)
│   ├── (public)/           # landing page
│   └── api/                # REST endpoints
│       ├── auth/           # Auth.js handler
│       ├── groups/         # group CRUD + members + billing
│       ├── confirm/        # email "I paid" token handler
│       ├── telegram/       # Telegram webhook
│       ├── cron/           # cron endpoints (billing, enqueue reminders/follow-ups, notification worker)
│       └── notifications/  # manual notification triggers
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # app shell (header, sidebar, footer)
│   └── features/           # feature components (groups, billing, etc.)
├── lib/
│   ├── db/mongoose.ts      # MongoDB connection singleton
│   ├── auth.ts             # Auth.js v5 configuration
│   ├── email/              # Resend client + React Email templates
│   ├── telegram/           # grammy bot, handlers, keyboards, send helpers
│   ├── billing/            # split calculation, period management
│   ├── notifications/      # unified dispatcher across channels
│   ├── tasks/              # task queue (enqueue, claim, worker)
│   └── tokens.ts           # HMAC tokens for confirmation links
├── models/                 # Mongoose schemas (User, Group, BillingPeriod, ScheduledTask, etc.)
├── jobs/                   # cron logic (billing, enqueue-reminders/follow-ups, run-notification-tasks)
└── types/                  # shared TypeScript types
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/db/mongoose.ts` | MongoDB connection with caching for serverless |
| `src/lib/auth.ts` | Auth.js v5 config (providers, adapter, callbacks) |
| `src/models/group.ts` | Group schema — the central data model |
| `src/models/billing-period.ts` | Billing period with per-member payment tracking |
| `src/lib/billing/calculator.ts` | Cost splitting logic (equal, fixed, variable) |
| `src/lib/notifications/service.ts` | Dispatches notifications across email + Telegram |
| `src/lib/telegram/bot.ts` | grammy bot instance and setup |
| `src/lib/telegram/handlers.ts` | Telegram callback handlers (payment confirmations) |
| `src/lib/tokens.ts` | HMAC token generation/verification for email links |
| `src/jobs/runner.ts` | node-cron scheduler entry point |
| `src/components/features/groups/group-detail-admin-actions.tsx` | Group header: Edit + **⋯** menu (initialize, import, delete) |
| `src/components/features/groups/delete-group-button.tsx` | Admin soft-delete group (calls `DELETE /api/groups/[groupId]`) |
| `src/lib/tasks/worker.ts` | Executes scheduled notification tasks (skips if payment no longer unpaid) |
| `src/app/api/scheduled-tasks/` | Admin list/cancel/retry/bulk-cancel for the task queue |

## Data Models

See `docs/data-models.md`. Quick summary:

- **User** — auth account + notification preferences + Telegram link
- **Group** — subscription config, members (embedded), billing settings, payment method
- **BillingPeriod** — one cycle per group per month, with per-member payment statuses
- **PriceHistory** — price change log per group
- **Notification** — delivery log for all sent messages
- **ScheduledTask** — queue for notification delivery (pending → locked → completed/failed/cancelled); task types used in production: `payment_reminder`, `aggregated_payment_reminder`, `admin_confirmation_request` only; admins manage via `/dashboard/scheduled-tasks` and `/api/scheduled-tasks/*`

## Conventions

- **Comments**: lowercase first letter, no period at end (e.g., `// calculate member share`)
- **API responses**: always return `{ data }` on success, `{ error: { code, message } }` on failure
- **Mongoose models**: defined in `src/models/`, exported from `src/models/index.ts`
- **Validation**: Zod schemas in route handlers, Mongoose validation as second layer
- **Environment**: all secrets via env vars, never hardcoded. See `.env.example`
- **Imports**: use `@/*` alias (maps to `src/*`)
- **Components**: shadcn/ui for primitives, feature components in `src/components/features/`

## Common Tasks

### Adding a new API route

1. Create `src/app/api/<resource>/route.ts`
2. Add Zod validation schema at the top
3. Check auth with `auth()` from `@/lib/auth`
4. Use Mongoose models from `@/models`
5. Return `NextResponse.json()`

### Adding a new notification type

1. Add the type to `Notification.type` enum in `src/models/notification.ts`
2. Create email template in `src/lib/email/templates/`
3. Add Telegram message builder in `src/lib/telegram/send.ts`
4. Register in `src/lib/notifications/service.ts`

### Adding a new cron job

1. For **reconciliation** (e.g. billing periods): create job in `src/jobs/<job-name>.ts`, register in `src/jobs/runner.ts`, optionally add `src/app/api/cron/<job-name>/route.ts`.
2. For **notification delivery**: add a task type in `src/models/scheduled-task.ts`, implement producer (enqueue in `src/jobs/enqueue-*.ts` or similar), add handler in `src/lib/tasks/worker.ts`, and enqueue from cron or from API (e.g. confirm flow).

### After shipping a version

After a version bump in `package.json` and a new section in `CHANGELOG.md`, sync documentation using `.cursor/skills/release-docs-sync/SKILL.md`. This ensures `docs/`, `content/docs/`, and `_context/` stay aligned with the changelog.

## References

- Architecture plan: `docs/PLAN.md`
- Data models: `docs/data-models.md`
- API design: `docs/api-design.md` (includes **Flows**: billing lifecycle, queued vs manual reminders, member confirm paths)
- Original Google Sheets scripts: `docs/legacy/` (for reference)
