---
title: Creating a Group
description: Configure a subscription group, billing mode, and payment method.
---

# Creating a Group

A **group** in SubsTrack represents one shared subscription. This page explains every option when creating or editing a group.

## Basic info

- **Group name** — Shown in the dashboard and in reminder emails (e.g. “YouTube Premium Family”).
- **Service name** — The product or bill (e.g. “YouTube Premium”, “Netflix”, “Internet bill”).
- **Description** (optional) — Internal note; not sent to members.

## Billing

### Total price

The amount you pay per billing period (e.g. 18 €/month). Members’ shares are calculated from this.

### Billing cycle

- **Billing day** — Day of the month the subscription renews (1–28). Reminders are sent after this day.
- **Cycle type** — Usually **Monthly**. Yearly is for annual plans.

### Billing mode

| Mode | How it works | When to use |
|------|----------------|-------------|
| **Equal split** | Total price ÷ number of people (you can include or exclude yourself). | Standard family/shared plans (YouTube, Netflix, Spotify). |
| **Fixed amount** | You set a fixed amount per member (e.g. 3 € each). | You absorb part of the cost or want a round number. |
| **Variable** | You enter the total for each period manually. | Utility bills, variable subscriptions. |

### Admin in split

- **Include me** — You are one of the people splitting the cost (e.g. 6 people including you → each pays 1/6).
- **Exclude me** — Only members pay; you don’t pay a share (e.g. 5 members → each pays 1/5 of the total).

### Grace period

Number of days after the billing day before the first reminder is sent (default: 3). Gives members time to pay before being reminded.

## Payment method

How members pay you:

- **Platform** — Revolut, PayPal, Bank transfer, Stripe (when available), or Custom.
- **Payment link** — URL included in reminders (e.g. `https://revolut.me/yourname` or `https://paypal.me/yourname`).
- **Instructions** (optional) — Extra text for bank transfer (IBAN, reference, etc.).

Members use this link to send their share; SubsTrack does not process payments.

## Members

- **Email** — Where reminders are sent; required.
- **Nickname** — Name used in the app and in reminders (e.g. “Alice”, “Bob”).
- **Custom amount** (optional) — Override the calculated share for this member (e.g. 2 € instead of 3 €).

You can add or remove members later; see [Managing members](/docs/user-guide/managing-members).

## Announcements

- **Notify on price change** — When you change the group’s price, members can be notified automatically.
- **Extra text** — Optional paragraph added to every reminder (e.g. “Billing updates on the 3rd. Contact me at …”).

## After saving

- A **billing period** is created for the current month (when applicable).
- Reminders are sent according to the cron schedule (see [Payment flow](/docs/user-guide/payment-flow)).
- You can always edit the group from the dashboard.
