# SubsTrack

Track shared subscriptions, automate payment reminders, and keep everyone honest.

One person pays for a shared service (YouTube Premium, Netflix, Spotify, a utility bill) and SubsTrack handles splitting costs, sending reminders, and tracking who has paid.

## Why

If you've ever managed a shared subscription, you know the pain: spreadsheets, manual Revolut requests, chasing people on WhatsApp. SubsTrack replaces all of that with a clean web UI, automated email/Telegram reminders, and a confirmation flow so everyone stays in sync.

## Features

- **Subscription groups** — Create a group for each shared service, add members by email
- **Automated reminders** — Cron-driven email and Telegram reminders for unpaid members
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
| Cron | [node-cron](https://github.com/node-cron/node-cron) |
| UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| Validation | [Zod](https://zod.dev) |

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- A Resend API key (free tier: 3,000 emails/month)
- (Optional) A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Setup

```bash
# clone the repo
git clone https://github.com/yourusername/subs-track.git
cd subs-track

# install dependencies
npm install

# copy environment variables
cp .env.example .env.local

# edit .env.local with your values (see Environment Variables below)

# run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker-compose up -d
```

This starts:
- The Next.js app on port 3000
- MongoDB on port 27017
- The cron job runner

### Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `NEXTAUTH_SECRET` | Random secret for Auth.js sessions |
| `NEXTAUTH_URL` | Your app URL (e.g., `http://localhost:3000`) |
| `RESEND_API_KEY` | Resend API key for sending emails |
| `EMAIL_FROM` | Sender email address |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather |
| `CRON_SECRET` | Secret for protecting cron API endpoints |
| `CONFIRMATION_SECRET` | HMAC secret for "I paid" confirmation links |

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
npm install
cp .env.example .env.local
# fill in your env vars
npm run dev
```

## License

[MIT](LICENSE)
