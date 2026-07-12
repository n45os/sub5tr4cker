<!-- last-updated: 2026-07-12 -->

# Tech Stack

## Runtime

- Node.js 20+
- Next.js 16 (App Router, RSC)
- TypeScript 5 (strict)

## Database

- **Advanced mode**: MongoDB 7 (via Docker or Atlas), Mongoose 8 ODM
- **Local mode**: SQLite (via `better-sqlite3`), zero-config, stored in `~/.sub5tr4cker/data.db`
- `StorageAdapter` interface + `MongooseAdapter` / `SqliteAdapter` in `src/lib/storage/`

## Auth

- **Advanced mode**: n450s_auth OAuth2/OIDC (primary since 0.39.0) — `src/lib/auth/n450s/` OAuth client, JWKS token verify, `s5_at`/`s5_rt` HttpOnly cookies, silent refresh in `src/middleware.ts`
- NextAuth (Auth.js v5) kept as an email/password fallback: `Credentials` provider + `magic-invite` provider for Telegram invite magic-login links; `/api/register` active
- **Local mode**: token cookie auto-login (`src/lib/auth/local.ts`)
- `@auth/mongodb-adapter` removed in 0.39.0; no Google or magic-link email providers (Google sign-in is federated by n450s_auth)

## Email

- Resend (primary, pluggable)
- React Email for templates

## Telegram

- grammy (Telegram bot framework)
- Local mode: polling (`pollOnce` for cron, `bot.start()` for server)
- Advanced mode: webhook (`/api/telegram/webhook`)

## Cron and task queue

- node-cron (self-hosted runner)
- Persisted task queue (ScheduledTask model) for notification delivery; worker claims and executes; idempotency and retries
- HTTP-triggered cron endpoints (for cloud hosting)

## UI

- Tailwind CSS 4
- shadcn/ui components
- App uses `@/*` import alias

## Validation

- Zod for API request validation
- Mongoose validation as second layer

## Dev Tools

- ESLint (next config)
- Docker Compose for local dev
