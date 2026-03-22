<!-- last-updated: 2026-03-21 -->

# Architecture

## Layers

1. **Presentation** — Next.js pages (RSC + client components), shadcn/ui
2. **API** — Next.js route handlers under `src/app/api/`
3. **Service** — business logic in `src/lib/` (billing calculator, notification dispatcher)
4. **Data** — Mongoose models in `src/models/`
5. **External** — MongoDB, Resend (email), Telegram Bot API

## Notification System

Unified dispatcher in `src/lib/notifications/service.ts` that routes to:
- Email via Resend (`src/lib/email/`)
- Telegram via grammy (`src/lib/telegram/`)

Email templates now share a common shell (`src/lib/email/layout.ts`) and theme presets (`src/lib/email/themes.ts`) selected per group via `group.service.emailTheme`.

Members choose their preferred channel(s). The dispatcher checks preferences and sends accordingly.

## Payment Confirmation

Primary flow uses member-portal deep links from reminder emails (`/member/[token]?pay=<periodId>&open=confirm`) so members review details before confirming. Legacy HMAC token links (`/api/confirm/[token]`) remain as fallback for previously sent emails. Telegram uses inline keyboard callbacks with colon-delimited data.

## Cron Jobs and Notification Queue

- **Reconciliation** — Cron runs billing period creation and overdue state (pending → overdue) in `src/jobs/`.
- **Notification delivery** — Producers enqueue tasks into `ScheduledTask`; worker in `src/lib/tasks/worker.ts` claims due tasks and sends via `src/lib/notifications/service.ts`. Idempotency per business event; retries with backoff.
- Self-hosted: node-cron process (`src/jobs/runner.ts`) runs billing, enqueue reminders/follow-ups, and the notification worker every 5 min.
- Hosted: HTTP endpoints `/api/cron/*` (billing, reminders, follow-ups, notification-tasks) protected by `x-cron-secret`; call notification-tasks frequently to process the queue.

## Telegram Bot

grammy library. Supports polling (dev) and webhook (prod) modes. Inspired by OpenClaw's architecture.

Reminder keyboards include **Show paying details** (`paydetails:periodId:memberId`): handler loads the billing period’s group and replies with platform, link, instructions, and optional announcement note (plain text).
