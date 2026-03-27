---
title: Telegram Setup
description: Link Telegram for instant reminders and one-tap payment confirmations.
---

# Telegram Setup

SubsTrack can send payment reminders and confirmation requests through **Telegram** as well as email. You get messages in the app and can confirm payments with a single tap.

## What you need

- A Telegram account
- SubsTrack instance with the Telegram bot enabled (your host or admin must have configured it)

## Linking your account

1. In SubsTrack, go to **Settings** (or **Account** / **Profile**).
2. Find **Notifications** or **Telegram**.
3. Click **Connect Telegram** (or **Link Telegram**).
4. You’ll see a link like `https://t.me/SubsTrackBot?start=link_xxxxx`.
5. Open that link on your phone or desktop. It opens Telegram and starts the bot.
6. Press **Start** (or send `/start`) if the bot asks.
7. The bot confirms the link. If you joined via a member **invite** link, it also summarizes the subscription, your share, how to pay, and what happens next.

Your SubsTrack user is now linked to your Telegram chat. Reminders and confirmation requests can be sent there.

## Bot commands

After you’re linked, you can also send:

- **`/services`** — Lists groups you belong to, your typical share, and whether you have an open period to pay (unpaid group billing windows only).
- **`/help`** — Short explanation of reminders, inline buttons, and these commands.

Plain **`/start`** (no invite payload) shows how to join or connect. On **local / CLI installs**, the wording favors invite links from your admin.

Telegram’s command menu (near the message field) may list **start**, **services**, and **help** after the bot has run once with a current build.

## What you receive in Telegram

- **Payment reminders** — When you owe a share, the bot sends a message with:
  - Group name and period
  - Amount to pay
  - Payment link (when configured)
  - Buttons: **I’ve paid** / **Remind later** / **Show paying details** (extra message with platform, link, and any instructions the admin saved for the group)
- **Admin confirmation requests** — If you’re the admin, when a member confirms payment you get a message with **Confirm** / **Reject** buttons.

## Confirming payment in Telegram

When you get a payment reminder:

1. Pay the admin using the payment link or tap **Show paying details** to open a second message with the full how-to-pay text from the group settings.
2. Tap **I’ve paid** in the Telegram message.
3. The bot updates the message to “Waiting for admin verification” (or similar).
4. When the admin confirms, that period is done for you.

No need to open email or the web app unless you want to.

## Admin: verifying payments in Telegram

When a member confirms, you get a message like:

- “Alice says they paid 3.00 € for YouTube Premium — March 2026”
- Buttons: **Confirm** / **Reject**

- Tap **Confirm** if you’ve received the payment. The bot will mark it as confirmed.
- Tap **Reject** if not; the member’s status goes back to pending and they’ll get reminders again.

## Notification preferences

In SubsTrack settings you can usually choose:

- **Email** — On or off
- **Telegram** — On or off (after linking)
- **Reminder frequency** — e.g. once, daily, or every 3 days

So you can use only Telegram, only email, or both.

## Unlinking

In SubsTrack **Settings** → **Telegram**, use **Disconnect** or **Unlink**. You’ll stop getting Telegram messages; email will still work if enabled.

## Troubleshooting

- **No messages** — Check that Telegram is enabled in your SubsTrack notification settings and that the bot was started via the link.
- **“Bot not found”** — The instance may not have the Telegram bot configured; ask your admin.
- **Link expired** — Request a new “Connect Telegram” link from settings; the old one may expire after a short time.
