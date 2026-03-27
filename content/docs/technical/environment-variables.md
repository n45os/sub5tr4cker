---
title: Environment Variables
description: All configuration options for SubsTrack.
---

# Environment Variables

Copy `.env.example` to `.env.local` (or set in your host’s env) and fill in the values below.

## Database

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string (e.g. `mongodb://localhost:27017/substrack` or Atlas URI). |

## Auth (Auth.js / NextAuth v5)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | Yes | Random secret for signing sessions. Generate: `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Yes | Full URL of the app (e.g. `http://localhost:3000` or `https://substrack.example.com`). |
| `GOOGLE_CLIENT_ID` | No | For “Sign in with Google”. |
| `GOOGLE_CLIENT_SECRET` | No | For “Sign in with Google”. |

## Email (Resend)

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Yes* | Resend API key. *Required if you send email. |
| `EMAIL_FROM` | Yes* | Sender address (e.g. `SubsTrack <noreply@yourdomain.com>`). |
| `EMAIL_ENABLED` | No | Master fallback for the workspace email channel. Defaults to `true`; the dashboard `email.enabled` setting can override it. |

## Telegram

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | No | Bot token from @BotFather. Required for Telegram reminders/confirmations. |
| `TELEGRAM_WEBHOOK_SECRET` | No | Random secret for webhook verification when using webhook mode. |
| `TELEGRAM_ENABLED` | No | Master fallback for the workspace Telegram channel. Defaults to `true`; the dashboard `telegram.enabled` setting can override it. |

## Security

| Variable | Required | Description |
|----------|----------|-------------|
| `CONFIRMATION_SECRET` | Yes | HMAC secret for “I’ve paid” email links. Generate: `openssl rand -base64 32`. |
| `CRON_SECRET` | Yes | Secret sent in `x-cron-secret` header when calling `/api/cron/*`. Generate: `openssl rand -base64 32`. |

## App

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_URL` | No | Same as `NEXTAUTH_URL` in practice; used for building confirmation links. Defaults to `NEXTAUTH_URL`. |
| `AGGREGATE_REMINDERS` | No | When set to `true`, members with the same email across groups receive one combined reminder per run (DB setting `notifications.aggregateReminders` overrides this when set in the app). |
| `NODE_ENV` | No | `development` or `production`. |

## Example

```env
MONGODB_URI=mongodb://localhost:27017/substrack
NEXTAUTH_SECRET=your-64-char-secret
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY=re_xxxx
EMAIL_FROM=SubsTrack <noreply@example.com>
EMAIL_ENABLED=true
CONFIRMATION_SECRET=your-hmac-secret
CRON_SECRET=your-cron-secret
TELEGRAM_BOT_TOKEN=optional
TELEGRAM_ENABLED=true
```

Never commit `.env.local` or put secrets in the client. Use your platform’s secret storage in production.
