# sub5tr4cker

Track shared subscriptions, automate payment reminders, and keep everyone honest.

One person pays for a shared service (YouTube Premium, Netflix, Spotify, a utility bill) and sub5tr4cker handles splitting costs, sending reminders, and tracking who has paid.

## Why

If you've ever managed a shared subscription, you know the pain: spreadsheets, manual Revolut requests, chasing people on WhatsApp. sub5tr4cker replaces all of that with a clean web UI, automated email/Telegram reminders, and a confirmation flow so everyone stays in sync.

## Features

- **Subscription groups** — Create a group for each shared service, add members by email
- **Automated reminders** — Queued notification tasks: cron enqueues reminders and a worker sends them via email/Telegram
- **Payment confirmation flow** — Members click "I paid" in email/Telegram → admin verifies
- **Multiple billing modes** — Equal split, fixed per-member amount, or variable (utility bills)
- **Payment links** — Revolut, PayPal, bank transfer, or custom links embedded in reminders
- **Price history** — Track price changes over time, notify members automatically
- **Telegram bot** — Link your Telegram for instant notifications and one-tap confirmations
- **Member dashboard** — Members see their subscription history and payment status
- **Admin dashboard** — Full overview of all groups, pending payments, and member activity

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org) (App Router) |
| Database | [MongoDB](https://mongodb.com) + [Mongoose](https://mongoosejs.com) |
| Auth | [Auth.js v5](https://authjs.dev) (NextAuth) |
| Email | [Resend](https://resend.com) (pluggable) |
| Telegram | [grammy](https://grammy.dev) |
| Cron / queue | [node-cron](https://github.com/node-cron/node-cron) + persisted task queue |
| UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| Validation | [Zod](https://zod.dev) |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (use Corepack: `corepack enable`)
- MongoDB (local or Atlas)
- A Resend API key (free tier: 3,000 emails/month)
- (Optional) A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Setup

```bash
# clone the repo
git clone https://github.com/n45os/sub5tr4cker.git
cd sub5tr4cker

# install dependencies
pnpm install

# bootstrap the app
pnpm setup

# run the development server
pnpm dev
```

`pnpm setup` writes the bootstrap `.env.local` values and seeds the remaining
runtime settings into MongoDB.

If you prefer npm scripts, `npm run setup` and `npm run configure` work too.

Open [http://localhost:3054](http://localhost:3054).

### Local MongoDB (no Docker)

To run MongoDB natively and store data in the repo root (e.g. for local development):

1. **Start MongoDB** with the project’s data directory (`.mongodb-data/` at repo root; created automatically by `pnpm setup`, or create it yourself):

   ```bash
   mongod --dbpath .mongodb-data --port 27017
   ```

2. **Point the app at local Mongo** by setting in `.env.local` (or via `pnpm setup`):

   ```
   MONGODB_URI=mongodb://localhost:27017/substrack
   ```

3. **Run the app** (in another terminal):

   ```bash
   pnpm dev
   ```

4. **Optional — run the cron runner** (billing periods, enqueue reminders/follow-ups, and notification worker every 5 min):

   ```bash
   pnpm run cron
   ```

Data lives under `.mongodb-data/` (git-ignored). Leave `mongod` running while you use the app.

### Documentation

Full documentation (user guide and technical reference) is built into the app:

- **On the same domain**: open `/docs` (e.g. [http://localhost:3000/docs](http://localhost:3000/docs))
- **User guide**: getting started, creating groups, managing members, payment flow, Telegram setup, FAQ
- **Technical**: architecture, API reference, data models, deployment, environment variables, contributing

Docs are static Markdown in `content/docs/` and are served by the Next.js app — no separate hosting needed.

### Docker

```bash
docker-compose up -d
```

This starts:
- The Next.js app on port 3054
- MongoDB on port 25417
- The cron runner (billing, enqueue reminders/follow-ups, notification worker)

### Environment Variables

Only bootstrap values stay in `.env.local`. Runtime settings such as `APP_URL`,
`RESEND_API_KEY`, `EMAIL_FROM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`CONFIRMATION_SECRET`, and `CRON_SECRET` now live in MongoDB and are managed from
the dashboard settings page.

Bootstrap variables:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `NEXTAUTH_SECRET` | Random secret for Auth.js sessions |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth client secret |
| `NODE_ENV` | Runtime mode (`development` or `production`) |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (auth)/             # Login, register pages
│   ├── (dashboard)/        # Protected dashboard pages
│   ├── (public)/           # Landing page
│   └── api/                # API routes
├── components/             # React components
│   ├── ui/                 # shadcn/ui base components
│   ├── layout/             # Header, sidebar, footer
│   └── features/           # Feature-specific components
├── lib/                    # Core business logic
│   ├── db/                 # Mongoose connection
│   ├── email/              # Email client and templates
│   ├── telegram/           # Telegram bot (grammy)
│   ├── billing/            # Billing calculation logic
│   └── notifications/      # Unified notification dispatcher
├── models/                 # Mongoose schemas
├── jobs/                   # Cron job definitions
└── types/                  # TypeScript types
```

## Architecture

See [docs/PLAN.md](docs/PLAN.md) for the full architecture plan, including:
- Billing modes and payment confirmation flow
- Notification channel design
- Cron job scheduling
- Feature roadmap (phases 1–4)
- Security considerations

See [docs/data-models.md](docs/data-models.md) for database schema documentation.

See [docs/api-design.md](docs/api-design.md) for the API route reference.

## How It Works

1. **Admin creates a group** — Picks a service name, sets the price and billing cycle, adds members by email
2. **Billing periods auto-create** — A cron job creates a new billing period entry each month
3. **Reminders go out** — Email and/or Telegram messages with payment link and "I paid" button
4. **Members confirm** — Click "I paid" in the email or tap the button in Telegram
5. **Admin verifies** — Gets a notification, confirms in the dashboard or via Telegram
6. **Repeat** — Fully automated cycle, every month

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

```bash
# fork and clone
pnpm install
cp .env.example .env.local
# fill in your env vars
pnpm dev
```

## License

[MIT](LICENSE)
