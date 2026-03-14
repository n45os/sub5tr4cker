---
name: substrack-development
description: Development guide for the SubsTrack shared subscription management app. Use when working on SubsTrack features, adding API routes, creating Mongoose models, implementing notification channels, building UI components, or setting up cron jobs. Triggers on "substrack", "subscription tracking", "billing period", "payment reminder", "member confirmation".
---

# SubsTrack Development Skill

## Quick Start

Before working on SubsTrack, read these files for context:

1. `AGENTS.md` — directory map, key files, common tasks
2. `docs/PLAN.md` — full architecture, billing modes, feature roadmap
3. `docs/data-models.md` — Mongoose schema documentation
4. `docs/api-design.md` — API route reference

## Adding a New Feature — Checklist

### New API Endpoint

1. Create route file at `src/app/api/<resource>/route.ts`
2. Define Zod schema for request validation
3. Add auth check (`auth()` from `@/lib/auth`)
4. Call `dbConnect()` before any DB operations
5. Use models from `@/models`
6. Return proper response format: `{ data }` or `{ error: { code, message } }`
7. Update `docs/api-design.md` with the new endpoint

### New Mongoose Model

1. Create file at `src/models/<model-name>.ts`
2. Define TypeScript interface extending `Document`
3. Create schema with `timestamps: true`
4. Add indexes
5. Export using `mongoose.models.X || mongoose.model()` pattern
6. Re-export from `src/models/index.ts`
7. Update `docs/data-models.md`

### New Notification Type

1. Add type to notification model enum
2. Create email template in `src/lib/email/templates/`
3. Add Telegram message builder in `src/lib/telegram/send.ts`
4. Register in `src/lib/notifications/service.ts`
5. Test both email and Telegram delivery

### New Cron Job

1. Create job logic in `src/jobs/<job-name>.ts`
2. Register in `src/jobs/runner.ts` with schedule
3. Optionally add HTTP trigger at `src/app/api/cron/<job>/route.ts`
4. Protect with `CRON_SECRET` header check

### New UI Feature

1. Check if shadcn/ui has the needed primitives (`npx shadcn@latest add <component>`)
2. Create feature components in `src/components/features/<feature>/`
3. Use server components by default, `'use client'` only when necessary
4. Follow the existing page patterns in `src/app/(dashboard)/`

## Telegram Integration

We use **grammy** (same as OpenClaw). Key patterns:

- Bot singleton in `src/lib/telegram/bot.ts`
- Inline keyboards for interactive buttons (max 64 bytes per callback_data)
- Callback data format: `action:param1:param2` (colon-delimited)
- Handlers in `src/lib/telegram/handlers.ts`
- Send helpers in `src/lib/telegram/send.ts`

For reference on grammy patterns, see the OpenClaw codebase at `~/Developer/forks/openclaw/src/telegram/`.

## Payment Confirmation Flow

The core flow to understand:

```
1. Cron → creates BillingPeriod with per-member entries (status: 'pending')
2. Cron → sends reminders (email with HMAC token link, Telegram with inline button)
3. Member clicks "I paid" → status becomes 'member_confirmed'
4. Admin gets notification → confirms → status becomes 'confirmed'
```

Email links use HMAC-SHA256 tokens (see `src/lib/tokens.ts`).
Telegram uses inline keyboard callbacks (see `src/lib/telegram/keyboards.ts`).

## Environment

All config via env vars. See `.env.example`. Key ones:
- `MONGODB_URI`, `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`
- `CONFIRMATION_SECRET` (for HMAC tokens), `CRON_SECRET` (for cron endpoints)
