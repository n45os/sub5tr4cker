<!-- last-updated: 2026-03-18 -->

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

Members choose their preferred channel(s). The dispatcher checks preferences and sends accordingly.

## Payment Confirmation

Uses HMAC-signed tokens (not JWTs) for email "I paid" links. Token contains memberId + periodId + expiry. Validated without DB lookup. Telegram uses inline keyboard callbacks with colon-delimited data.

## Cron Jobs

Self-hosted: node-cron process (`src/jobs/runner.ts`)
Hosted: HTTP-triggered endpoints at `/api/cron/*` protected by secret header

## Telegram Bot

grammy library. Supports polling (dev) and webhook (prod) modes. Inspired by OpenClaw's architecture.
