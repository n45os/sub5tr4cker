<!-- last-updated: 2026-03-18 -->

# Tech Stack

## Runtime

- Node.js 20+
- Next.js 15 (App Router, RSC)
- TypeScript 5 (strict)

## Database

- MongoDB 7 (via Docker or Atlas)
- Mongoose 8 ODM

## Auth

- Auth.js v5 (next-auth@beta)
- @auth/mongodb-adapter
- Providers: Credentials, Google OAuth, Magic Link

## Email

- Resend (primary, pluggable)
- React Email for templates (planned)

## Telegram

- grammy (Telegram bot framework)
- Polling mode for dev, webhook for prod

## Cron

- node-cron (self-hosted)
- HTTP-triggered endpoints (for cloud hosting)

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
