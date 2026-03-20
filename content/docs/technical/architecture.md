---
title: Architecture
description: System design, layers, and data flow for developers.
---

# Architecture

This page gives developers a high-level view of how SubsTrack is built.

## Vision

SubsTrack is an open-source web app for managing shared subscriptions. One person (the **admin**) pays for a service and splits the cost with **members**. The app automates reminders, tracks payments, and supports a confirmation flow (member says “I paid” → admin verifies).

## Core concepts

- **Group** — One shared subscription (e.g. YouTube Premium Family). Has an admin, members, billing config, and payment method.
- **Billing period** — One cycle (e.g. one month) per group. Contains per-member payment entries and statuses.
- **Payment flow** — `pending` → member confirms → `member_confirmed` → admin verifies → `confirmed`.

## Tech stack

| Layer | Technology |
|-------|-------------|
| Framework | Next.js 15 (App Router) |
| Database | MongoDB + Mongoose |
| Auth | Auth.js v5 (NextAuth) |
| Email | Resend (pluggable) |
| Telegram | grammy |
| Cron / queue | node-cron + persisted task queue (ScheduledTask) / HTTP-triggered |
| UI | Tailwind CSS, shadcn/ui |
| Validation | Zod |

## High-level architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Pages   │  │  API Routes   │  │  Server Actions    │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│       └───────────────┼───────────────────┘              │
│  ┌────────────────────▼─────────────────────────────┐   │
│  │              Service layer                        │   │
│  │  (billing calculator, notifications, tokens)      │   │
│  └────────────────────┬─────────────────────────────┘   │
│  ┌────────────────────▼─────────────────────────────┐   │
│  │              Data layer (Mongoose)                │   │
│  └────────────────────┬─────────────────────────────┘   │
└────────────────────────┼────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    MongoDB          Resend         Telegram API
```

## Directory structure

- **`src/app/`** — Next.js pages and API routes (App Router).
- **`src/lib/`** — Core logic: `db/`, `auth`, `email/`, `telegram/`, `billing/`, `notifications/`, `tokens`.
- **`src/models/`** — Mongoose schemas (User, Group, BillingPeriod, etc.).
- **`src/jobs/`** — Cron job definitions (billing periods, enqueue reminders/follow-ups, run notification worker). **`src/lib/tasks/`** — Task queue (enqueue, claim, worker).
- **`src/components/`** — UI components.

## Notification system

A single **notification service** (`src/lib/notifications/service.ts`) dispatches to:

- **Email** — Resend; templates can be React Email or HTML.
- **Telegram** — grammy bot; messages can include inline keyboards (e.g. “I’ve paid”, “Show paying details”, “Confirm”).

Recipients have preferences (email on/off, Telegram on/off). The service checks those and sends to the right channels.

## Payment confirmation

- **Email** — HMAC-signed tokens in “I’ve paid” links. Token payload: memberId, periodId, groupId, expiry. Verified without DB lookup.
- **Telegram** — Inline keyboard callbacks with `action:periodId:memberId`. Handlers update BillingPeriod and optionally notify the admin.

## Cron jobs and notification queue

- **Reconciliation** — Cron runs billing period creation and overdue state updates (pending → overdue).
- **Notification delivery** — Cron enqueues tasks into the `ScheduledTask` collection; a worker (run every 5 min in the same runner or via HTTP) claims due tasks and sends via the notification service. This gives retries, idempotency, and observability (task counts by status).
- **Self-hosted** — A Node process runs `node-cron` (see `src/jobs/runner.ts`): billing periods, enqueue reminders/follow-ups, and the notification worker.
- **Hosted** — HTTP endpoints under `/api/cron/*` protected by `x-cron-secret`; call `POST /api/cron/notification-tasks` frequently (e.g. every 5 min) to process the queue.

## Security

- Auth: Auth.js session (JWT or database session).
- Cron: `CRON_SECRET` header.
- Confirmation links: HMAC with `CONFIRMATION_SECRET`.
- Telegram webhook: optional secret token.
- No secrets in client; all sensitive config via environment variables.

For more detail, see the full [Architecture Plan](https://github.com/yourusername/subs-track/blob/main/docs/PLAN.md) in the repo.
