---
title: FAQ
description: Frequently asked questions about SubsTrack.
---

# FAQ

## General

### What is SubsTrack?

SubsTrack is an open-source app for managing **shared subscriptions**. One person (the admin) pays for a service (e.g. YouTube Premium, Netflix) and splits the cost with others. The app sends payment reminders, tracks who has paid, and lets members confirm with one click and the admin verify in the app or Telegram.

### Do I need to self-host it?

You can self-host (Docker, your own server) or use a hosted instance if someone offers one. The app is open source, so you can run it yourself.

### Is there a mobile app?

There is no native mobile app yet. The web app works in the browser on phones. Telegram can be used for reminders and confirmations on mobile.

---

## For admins

### How do I add a payment link (Revolut, PayPal)?

When creating or editing a group, set **Payment method** → **Payment link** to your Revolut link (e.g. `https://revolut.me/yourname`), PayPal link (`https://paypal.me/yourname`), or any URL. That link is included in every reminder. SubsTrack does not process payments; members pay you directly.

### Can I change the price mid-year?

Yes. Edit the group and change **Total price**. You can optionally notify members (if the feature is enabled). Future billing periods use the new price; past periods stay unchanged.

### What if someone leaves or joins mid-month?

Edit the group’s members: **Remove** the person who left or **Add** the new one. The change applies to **future** billing periods. For the current month you can manually adjust the period (e.g. waive or set custom amounts) if your instance supports it.

### Who can see the group?

Only you (the admin) and the members you add. Members see only the groups they’re in and their own payment status. There is no public listing.

### Can I have multiple groups?

Yes. You can be the admin of several groups (e.g. YouTube Premium, Netflix, a shared utility bill). Each group has its own members, price, and billing periods.

---

## For members

### Do I need an account to receive reminders?

No. If the admin adds your email, you’ll get reminder emails with the amount and a payment link. You can confirm payment by clicking “I’ve paid” in the email without signing up. Optionally you can create an account to use the dashboard and Telegram.

### How do I confirm I paid?

- **Email**: Click the “I’ve paid” link in the reminder.
- **Telegram**: Tap the “I’ve paid” button in the bot message.

After that, the admin verifies and marks it as confirmed. You might see “Waiting for admin verification” until they do.

### The “I’ve paid” link says invalid or expired.

Links expire after a few days for security. Ask the admin to send a new reminder, or use Telegram if you’ve linked your account.

### Can I pay in a different currency?

SubsTrack shows the amount in the currency the admin set (e.g. EUR). You and the admin agree on how to pay (Revolut, PayPal, etc.); the app doesn’t convert currencies.

---

## Technical

### How are reminders sent?

A scheduled job (cron) runs on the server (e.g. daily). It finds billing periods whose collection window is open and that are past the grace period (counted from when that window opened), then sends reminders by email (and Telegram if configured) to members who haven’t paid. The schedule is set by whoever runs the instance.

### Is my data secure?

SubsTrack stores groups, members, and payment status in a database (e.g. MongoDB). Passwords are hashed; confirmation links are signed. You should run it over HTTPS and protect the server and database. If you self-host, you control the data.

### Can I export my data?

Export (e.g. CSV of payment history) is planned. For now, data is in the database; admins with server access can export it manually.

### Where can I report bugs or contribute?

The project is open source. Use the repository’s issue tracker for bugs and feature requests, and follow the project’s contributing guide for code or docs contributions. See [Contributing](/docs/technical/contributing) in the technical docs.
