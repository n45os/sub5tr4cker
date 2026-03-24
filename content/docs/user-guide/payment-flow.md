---
title: Payment Flow
description: How reminders, confirmations, and admin verification work.
---

# Payment Flow

SubsTrack automates reminders and tracks who has paid. Here’s the full flow.

## Overview

1. **Billing period** — Created automatically (or manually) for each month.
2. **Reminders** — Sent by email (and optionally Telegram) to members who haven’t paid.
3. **Member confirms** — Member opens “Verify payment” from email (member portal) or taps “I’ve paid” in Telegram.
4. **Admin verifies** — You confirm the payment in the dashboard or in Telegram.
5. **Done** — Status is set to confirmed; no more reminders for that period.

## Billing periods

- One **billing period** per group per month (or per cycle).
- Each period has a **total price** and a **payment entry** per member with:
  - **Amount** they owe
  - **Status**: `pending` → `member_confirmed` → `confirmed` (or `overdue` / `waived`)

Periods are created automatically by a cron job when the **collection window** opens (on the billing day, or earlier if you set **payment in advance** on the group). You can also create or edit periods manually for variable billing.

## Reminders

- **When** — After the **grace period** (e.g. 3 days) **from when the collection window opens** (renewal day, or earlier if you use payment in advance). Exact time depends on the server’s cron schedule (e.g. daily at 10:00).
- **Who** — Only members with status **pending** or **overdue**.
- **Channels** — Email always (if the member has an email). Telegram if they’ve linked their account and have Telegram enabled.

The reminder includes:

- Group name and period (e.g. “March 2026”)
- Amount they owe
- Your payment link
- Button or link: **“Verify payment”** (email) or **“I’ve paid”** (Telegram)

## Confirming payment (member)

Two ways:

1. **Email** — Click **Verify payment** in the reminder. It opens your member portal with the period preselected, where you review payment details and submit confirmation in a modal.
2. **Telegram** — Use **Show paying details** if you need the full payment instructions; tap **I’ve paid** under the reminder when you’ve sent the money.

After that, their status becomes **member_confirmed**. They may see a message like “Waiting for admin verification.”

## Verifying payment (admin)

When a member confirms, you get a notification (email and/or Telegram) with something like: “Alice says they paid 3 € for YouTube Premium — March 2026.”

You can then:

1. **Dashboard** — Open the group → Billing / History → find the period and member → **Confirm** or **Reject**.
2. **Telegram** — Use the **Confirm** / **Reject** buttons in the bot message.

- **Confirm** — Status becomes **confirmed**. No more reminders for that payment.
- **Reject** — Status goes back to **pending**; they’ll get reminders again.

Only you (the admin) can confirm; members cannot confirm for each other.

## Statuses

| Status | Meaning |
|--------|--------|
| **pending** | Not paid yet; will receive reminders. |
| **member_confirmed** | Member said they paid; waiting for your verification. |
| **confirmed** | You verified the payment. Done. |
| **overdue** | Still not paid after a long time (e.g. 14+ days); reminders continue. |
| **waived** | You waived this member’s payment for this period. |

## Follow-up reminders

A separate job can send **follow-up** reminders (e.g. every 3 days) to members who are still pending, and **nudge you** when there are payments in **member_confirmed** waiting for your verification.

## Summary

- Reminders are automatic; members get email (and optionally Telegram).
- Members confirm with one click; you verify in the app or Telegram.
- Until you confirm, they stay in “member_confirmed” and you may get nudges to verify.
