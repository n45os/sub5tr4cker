<!-- context-status: active -->
<!-- last-updated: 2026-03-18 -->

# SubsTrack — Project Context

Open-source Next.js app for managing shared subscriptions. Admin pays for a service, splits cost with members, automates reminders and payment tracking.

## Quick Facts

- **Stack**: Next.js 15 (App Router), MongoDB/Mongoose, Auth.js v5, Resend, grammy, node-cron
- **UI**: Tailwind CSS (shadcn/ui placeholders; feature components in `src/components/features/`)
- **Origin**: Migrated from a Google Sheets + Apps Script setup (see `docs/legacy/`)
- **Phase**: Phase 1 MVP implemented; Phase 2 Telegram/link and follow-ups in place

## Key Directories

- `src/app/` — pages + API routes (auth, dashboard, groups, billing, telegram, cron)
- `src/app/(auth)/` — login, register
- `src/app/(dashboard)/` — dashboard home, groups list, group detail, new group
- `src/app/api/` — groups CRUD, members, billing, confirm, telegram webhook/link, cron (billing, reminders, follow-ups), register
- `src/lib/` — db, auth, tokens (confirmation + link), email, telegram, billing calculator, notifications
- `src/models/` — Mongoose schemas (User, Group, BillingPeriod, PriceHistory, Notification)
- `src/jobs/` — check-billing-periods, send-reminders, send-follow-ups, runner
- `src/components/features/groups/` — GroupCard and group UI
- `docs/` — architecture plan, data models, API design

## Core Flow

1. Admin creates group → adds members → sets billing config
2. Cron creates billing periods monthly (or manual for variable mode)
3. Reminders sent via email/Telegram with payment link
4. Member confirms ("I paid") via email link or dashboard self-confirm or Telegram
5. Admin confirms in dashboard or via Telegram → status confirmed

## Implemented APIs (see docs/api-design.md)

- Groups: GET/POST /api/groups, GET/PATCH/DELETE /api/groups/[groupId]
- Members: POST/PATCH/DELETE /api/groups/[groupId]/members(/[memberId])
- Billing: GET/POST /api/groups/[groupId]/billing, PATCH period, confirm, self-confirm
- Auth: /api/auth/[...nextauth], POST /api/register
- Telegram: POST /api/telegram/webhook, POST /api/telegram/link
- Cron: POST /api/cron/billing, reminders, follow-ups (CRON_SECRET)
- Confirm: GET /api/confirm/[token] (email "I paid")

## Context Files

- `_context/architecture.md` — system design details
- `_context/stack.md` — dependencies and versions
- `_context/conventions.md` — code patterns
- `_context/integrations.md` — external service details
