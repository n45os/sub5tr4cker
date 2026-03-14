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
| Cron | node-cron / HTTP-triggered |
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
- **`src/jobs/`** — Cron job definitions (billing periods, reminders, follow-ups).
- **`src/components/`** — UI components.

## Notification system

A single **notification service** (`src/lib/notifications/service.ts`) dispatches to:

- **Email** — Resend; templates can be React Email or HTML.
- **Telegram** — grammy bot; messages can include inline keyboards (e.g. “I’ve paid”, “Confirm”).

Recipients have preferences (email on/off, Telegram on/off). The service checks those and sends to the right channels.

## Payment confirmation

- **Email** — HMAC-signed tokens in “I’ve paid” links. Token payload: memberId, periodId, groupId, expiry. Verified without DB lookup.
- **Telegram** — Inline keyboard callbacks with `action:periodId:memberId`. Handlers update BillingPeriod and optionally notify the admin.

## Cron jobs

- **Self-hosted** — A Node process runs `node-cron` (see `src/jobs/runner.ts`). Jobs: create billing periods, send reminders, send follow-ups.
- **Hosted** — HTTP endpoints under `/api/cron/*` protected by a secret header; an external scheduler (e.g. cron-job.org, GitHub Actions) calls them.

## Security

- Auth: Auth.js session (JWT or database session).
- Cron: `CRON_SECRET` header.
- Confirmation links: HMAC with `CONFIRMATION_SECRET`.
- Telegram webhook: optional secret token.
- No secrets in client; all sensitive config via environment variables.

For more detail, see the full [Architecture Plan](https://github.com/yourusername/subs-track/blob/main/docs/PLAN.md) in the repo.
