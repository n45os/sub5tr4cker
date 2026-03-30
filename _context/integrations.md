<!-- last-updated: 2026-03-27 -->

# Integrations

## MongoDB

- Connection string via `MONGODB_URI` env var
- Singleton connection in `src/lib/db/mongoose.ts` with caching for serverless
- Docker Compose runs MongoDB 7 locally

## Resend (Email)

- API key via `RESEND_API_KEY`
- Sender address via `EMAIL_FROM`
- Client wrapper in `src/lib/email/client.ts`
- Free tier: 3,000 emails/month
- Alternative: can swap for SendGrid or Nodemailer/SMTP

## Telegram (grammy)

- Bot token via `TELEGRAM_BOT_TOKEN`
- Webhook secret via `TELEGRAM_WEBHOOK_SECRET`
- Bot code in `src/lib/telegram/`
- Polling mode for development, webhook via `/api/telegram/webhook` for production
- **`/start`** with `link_` / `invite_` payloads; **`/services`** (subscriptions + open-period status); **`/help`**; `setMyCommands` on bot init
- Rich DM after **`invite_`** accept: share, billing, payment text, next steps
- Inline keyboards for payment confirmation (**I've Paid**, **Remind later**, **Show paying details**) and admin **Confirm** / **Reject**

## Auth.js v5

- Secret via `NEXTAUTH_SECRET`
- MongoDB adapter stores sessions and accounts
- Google OAuth optional (needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`)
- In local mode, auth uses a token cookie with auto-login (no MongoDB adapter or sessions)

## Payment Platforms (Phase 1)

- Simple links — no API integration
- Revolut: `revolut.me/username`
- PayPal: `paypal.me/username`
- Bank transfer: IBAN displayed in reminder
- Custom: any URL

## Stripe (Phase 2 — planned)

- OAuth connect for admin accounts
- Checkout Sessions for member payments
- Webhooks for automatic payment verification
