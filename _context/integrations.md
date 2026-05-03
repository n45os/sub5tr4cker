<!-- last-updated: 2026-05-04 -->

# Integrations

## MongoDB

- Connection string via `MONGODB_URI` env var
- Singleton connection in `src/lib/db/mongoose.ts` with caching for serverless
- Docker Compose runs MongoDB 7 locally

## n450s_auth (advanced mode)

- OAuth2/OIDC: `AUTH_SERVICE_URL`, `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET`, registered redirect URIs; HttpOnly cookies `s5_at` / `s5_rt` hold tokens; middleware refreshes access tokens
- Local `User.authIdentityId` stores the verified JWT `sub`; the OAuth callback links that sub to an existing user when email matches (**userinfo first, then access token `email` claim**) so pre-existing accounts are not stranded
- Placeholder users (`<sub>@n450s.local`) only appear when no email can be resolved; session display prefers the DB mailbox over synthetic `@n450s.local` from the token

## Resend (Email)

- API key via `RESEND_API_KEY`
- Sender address via `EMAIL_FROM`
- Client wrapper in `src/lib/email/client.ts`
- Free tier: 3,000 emails/month
- Alternative: can swap for SendGrid or Nodemailer/SMTP

## Telegram (grammy)

- `s54r init` and `pnpm setup` steer admins toward Telegram first: members tap **I've paid** in the bot more reliably than from email
- Bot token via `TELEGRAM_BOT_TOKEN`
- Webhook secret via `TELEGRAM_WEBHOOK_SECRET`
- Bot code in `src/lib/telegram/`
- Polling mode for development, webhook via `/api/telegram/webhook` for production
- **`/start`** with `link_` / `invite_` payloads; **`/services`** (subscriptions + open-period status); **`/help`**; `setMyCommands` on bot init
- Rich DM after **`invite_`** accept: share, billing, payment text, next steps
- Inline keyboards for payment confirmation (**I've Paid**, **Remind later**, **Show paying details**) and admin **Confirm** / **Reject**

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
