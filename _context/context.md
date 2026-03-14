<!-- context-status: initializing -->
<!-- last-updated: 2026-03-18 -->

# SubsTrack — Project Context

Open-source Next.js app for managing shared subscriptions. Admin pays for a service, splits cost with members, automates reminders and payment tracking.

## Quick Facts

- **Stack**: Next.js 15 (App Router), MongoDB/Mongoose, Auth.js v5, Resend, grammy, node-cron
- **UI**: Tailwind CSS + shadcn/ui
- **Origin**: Migrated from a Google Sheets + Apps Script setup (see `docs/legacy/`)
- **Phase**: Early development (Phase 1 — MVP)

## Key Directories

- `src/app/` — pages + API routes
- `src/lib/` — core business logic (db, auth, email, telegram, billing, notifications)
- `src/models/` — Mongoose schemas
- `src/jobs/` — cron job definitions
- `docs/` — architecture plan, data models, API design

## Core Flow

1. Admin creates group → adds members → sets billing config
2. Cron creates billing periods monthly
3. Reminders sent via email/Telegram with payment link
4. Member confirms ("I paid") → admin verifies → marked as confirmed

## Context Files

- `_context/architecture.md` — system design details
- `_context/stack.md` — dependencies and versions
- `_context/conventions.md` — code patterns
- `_context/integrations.md` — external service details
