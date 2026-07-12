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

## Auth

Advanced mode authenticates against an n450s_auth (OAuth2/OIDC) service, with a NextAuth email/password fallback.

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SERVICE_URL` | Yes | Base URL of the n450s_auth service. |
| `OAUTH_CLIENT_ID` | Yes | OAuth client id registered in n450s_auth. |
| `OAUTH_CLIENT_SECRET` | Yes | OAuth client secret. |
| `OAUTH_REDIRECT_URIS` | Yes | Comma-separated allowed redirect URIs (must include `<app-url>/api/auth/n450s/callback`). |
| `NEXTAUTH_SECRET` | Yes | Random secret for the fallback session and settings encryption. Generate: `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Yes | Full URL of the app (e.g. `http://localhost:3054` or `https://sub5tr4cker.example.com`). |

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
| `APP_URL` | No | Same as `NEXTAUTH_URL` in practice; used for confirmation links, invite URLs, **and** n450s OAuth post-login redirects behind Docker/reverse proxies. Defaults to settings seed / dashboard **App URL**; set early in prod so redirects never use an internal `:3000` host. |
| `AGGREGATE_REMINDERS` | No | When set to `true`, members with the same email across groups receive one combined reminder per run (DB setting `notifications.aggregateReminders` overrides this when set in the app). |
| `NODE_ENV` | No | `development` or `production`. |

## Legal / privacy pages

Operator details shown on the public `/privacy`, `/cookies`, and `/terms` pages. In advanced mode these are easier to set from the dashboard (**Settings → Legal & privacy**); the env vars act as fallbacks (and are the way to set them in local mode). Any left empty render as clearly-marked placeholders.

| Variable | Required | Description |
|----------|----------|-------------|
| `LEGAL_ENTITY_NAME` | No | Legal entity / operator name acting as data controller. |
| `LEGAL_CONTACT_EMAIL` | No | Email for privacy questions and data-subject requests. |
| `LEGAL_CONTACT_ADDRESS` | No | Postal/registered address (omitted from the pages when empty). |
| `LEGAL_JURISDICTION` | No | Governing law / country (e.g. `Greece`), used in Terms and the transfers note. |
| `LEGAL_SUPERVISORY_AUTHORITY` | No | Data protection authority users can complain to (GDPR rights section). |
| `LEGAL_HOSTING_PROVIDER` | No | Where the instance + database are hosted (data-storage / transfers note). |
| `LEGAL_LAST_UPDATED` | No | ISO date (`YYYY-MM-DD`) shown as the policies' effective date. Defaults to today. |

## Example

```env
MONGODB_URI=mongodb://localhost:27017/substrack
AUTH_SERVICE_URL=https://auth.example.com
OAUTH_CLIENT_ID=sub5tr4cker
OAUTH_CLIENT_SECRET=your-oauth-secret
OAUTH_REDIRECT_URIS=http://localhost:3054/api/auth/n450s/callback
NEXTAUTH_SECRET=your-64-char-secret
NEXTAUTH_URL=http://localhost:3054
RESEND_API_KEY=re_xxxx
EMAIL_FROM=SubsTrack <noreply@example.com>
EMAIL_ENABLED=true
CONFIRMATION_SECRET=your-hmac-secret
CRON_SECRET=your-cron-secret
TELEGRAM_BOT_TOKEN=optional
TELEGRAM_ENABLED=true
```

Never commit `.env.local` or put secrets in the client. Use your platform’s secret storage in production.
