---
title: Deployment
description: How to run SubsTrack in production (Docker, Vercel, and cron).
---

# Deployment

SubsTrack can be self-hosted or run on a platform. You need: Node.js 20+, MongoDB, and (optionally) Resend and a Telegram bot.

## Environment variables

Set at least:

- `MONGODB_URI` — MongoDB connection string
- `NEXTAUTH_SECRET` — random secret (e.g. `openssl rand -base64 32`)
- `NEXTAUTH_URL` — public URL of the app (e.g. `https://substrack.example.com`)
- `RESEND_API_KEY` — if using Resend
- `EMAIL_FROM` — sender address
- `CONFIRMATION_SECRET` — for “I’ve paid” links
- `CRON_SECRET` — for cron API routes

Optional: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

See [Environment variables](/docs/technical/environment-variables) for the full list.

## Docker (self-hosted)

From the repo root:

```bash
cp .env.example .env.local
# edit .env.local with your values

docker-compose up -d
```

This starts:

- **app** — Next.js on port 3000
- **mongo** — MongoDB on 27017
- **cron** — node-cron runner (billing, enqueue reminders/follow-ups, notification worker; same image, different command)

Build: `docker-compose build`. Logs: `docker-compose logs -f app`.

## Manual (Node + MongoDB)

1. Install Node 20+ and MongoDB.
2. Clone the repo, run `npm ci`, copy `.env.example` to `.env.local` and fill it.
3. Build: `npm run build`.
4. Start app: `npm start` (port 3000 by default).
5. Start cron (separate process): `npm run cron`.

Use a process manager (systemd, PM2) to keep both running.

## Vercel (or similar)

- Deploy the Next.js app (e.g. connect GitHub to Vercel).
- Set env vars in the dashboard; add `MONGODB_URI` (e.g. Atlas).
- The app runs as serverless; **cron does not run inside Vercel**. Options:
  - **External cron**: Use [Vercel Cron](https://vercel.com/docs/cron-jobs) or an external service (cron-job.org, GitHub Actions) to call:
    - `POST /api/cron/billing` (daily)
    - `POST /api/cron/reminders` (daily)
    - `POST /api/cron/follow-ups` (e.g. every 3 days)
    - `POST /api/cron/notification-tasks` (every 5 min) with the `x-cron-secret` header.
  - **Separate worker**: Run the cron runner (`npm run cron`) on a small VPS or Railway; it will enqueue tasks and run the notification worker every 5 min.

## Telegram

- **Polling** — Run the bot in a long-lived process (e.g. same server as the app or a separate container) that calls grammy’s polling. No public URL needed for the bot.
- **Webhook** — Set the bot webhook to `https://your-domain.com/api/telegram/webhook` and ensure that route verifies the webhook secret. Then the Next.js app handles updates; no separate bot process.

## HTTPS

Use HTTPS in production. Set `NEXTAUTH_URL` and `APP_URL` (or the dashboard **App URL** setting under General) to the same public `https://` URL users see—especially when the app listens on `localhost` or `:3000` behind Docker/NPM; n450s login uses that value for redirects. If you use a reverse proxy (Nginx, Caddy, Nginx Proxy Manager), terminate SSL there and **forward `X-Forwarded-Host` and `X-Forwarded-Proto`** to the upstream so redirects stay on your public hostname when `APP_URL` is not yet set.

## Database

- **MongoDB Atlas** — Create a cluster, whitelist IPs or use VPC peering, set `MONGODB_URI` in env.
- **Self-hosted MongoDB** — Install and run MongoDB, create a database (e.g. `substrack`), set `MONGODB_URI=mongodb://host:27017/substrack`.

No migrations required; Mongoose creates collections and indexes on first use.
