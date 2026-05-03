---
title: Getting Started
description: Set up SubsTrack and create your first subscription group in minutes.
---

# Getting Started

SubsTrack helps you manage shared subscriptions — one person pays the bill, and everyone splits the cost. This guide gets you from zero to your first payment reminder.

## What you need

- A SubsTrack instance (self-hosted or the official deployment)
- An account (sign up with email or Google)
- The subscription you want to share (e.g. YouTube Premium, Netflix) and its monthly price

## Sign up

1. Open the SubsTrack URL (e.g. `https://substrack.example.com`).
2. Click **Sign in** or **Get started**.
3. Sign in with **Google** or create an account with your **email and password**.

You’re in. The next step is creating a group.

## Create your first group

A **group** is one shared subscription (e.g. “YouTube Premium Family”). You’ll be the **admin**: you pay the full price and collect each member’s share.

1. From the dashboard, click **New group** (or **Create group**).
2. Fill in:
   - **Group name** — e.g. “YouTube Premium Family”
   - **Service name** — e.g. “YouTube Premium”
   - **Total price per month** — the amount you’re charged (e.g. 18 €)
   - **Billing day** — day of the month the subscription renews (e.g. 3)
   - **Payment link** — where members send their share (e.g. your Revolut or PayPal link)
3. Add **members**: email and a short nickname for each person.
4. Choose whether **you (the admin)** are included in the split. If yes, the cost is divided by (members + you); if no, only among members.
5. Save the group.

SubsTrack will create a **billing period** for the current month and, when the time comes, send **payment reminders** to everyone who hasn’t paid.

## Dashboard overview

The home dashboard lists every group you belong to — as **owner** or **member**. If you own at least one group, a **Subscriptions you pay for** table summarizes those services (price, member count, next billing date, and who still needs attention) with **Open** and **Delete** shortcuts.

## Deleting a group

Only the **admin** can delete a group. You’ll find **Delete** on the group page header, in the admin table on the dashboard, or under **Danger zone** at the bottom of **Edit group**. Deleting removes the group from the app for everyone; billing history is retained for audit.

## What happens next

- **Reminders** — On the schedule you set (or the default), members get Telegram and/or email with the amount they owe and your payment link.
- **“I’ve paid”** — Telegram is the smoothest path (one tap in the bot). Email links work too but are easier to miss.
- **You verify** — You get a notification and mark the payment as confirmed in the dashboard (or in Telegram).
- **Repeat** — Each month a new period is created and reminders go out automatically.

## Next steps

- [Creating a group](/docs/user-guide/creating-a-group) — more options (billing modes, grace period, extra text).
- [Managing members](/docs/user-guide/managing-members) — add/remove members, custom amounts.
- [Payment flow](/docs/user-guide/payment-flow) — how reminders and confirmations work.
- [Telegram setup](/docs/user-guide/telegram-setup) — receive reminders and confirm payments in Telegram.
