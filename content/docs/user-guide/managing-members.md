---
title: Managing Members
description: Add, remove, and configure members in a subscription group.
---

# Managing Members

Members are the people who owe a share each billing period. You can add them when creating a group or later from the group page.

## Adding members

1. Open the group and go to **Members** (or **Edit group**).
2. Click **Add member**.
3. Enter:
   - **Email** — Where reminders are sent (required).
   - **Nickname** — Display name in the group and in emails.
   - **Custom amount** (optional) — Fixed amount for this member instead of the calculated share.
4. Save.

The new member will be included in the **next** billing period. For the current period you’d need to create or edit it manually (or wait for the next cycle).

## Member without an account

Members do **not** need a SubsTrack account to receive reminders. They get an email with:

- The amount they owe
- Your payment link
- An “I’ve paid” link to confirm

If they sign up later, they can link their account and use Telegram and the dashboard.

If your SubsTrack app only runs on a local/private URL, regular web invite links are disabled because other people cannot open `localhost` links from their own devices. In that setup, use the member row action to copy a Telegram invite link and send it directly.

## Editing a member

You can change:

- **Nickname**
- **Custom amount** (override the calculated share)
- **Active** — Inactive members are excluded from future periods and reminders.

Changes apply to **future** billing periods. Past periods are not recalculated.

## Removing a member

Removing is **soft**: the member is marked as left and no longer gets reminders or appears in new periods. Past periods stay as they are.

1. Open the group → **Members**.
2. Find the member and choose **Remove** (or **Deactivate**).
3. Confirm.

They won’t be included in the next billing period.

## Custom amounts

Use **custom amount** when:

- One person pays less (e.g. you cover part of their share).
- You want a round number per person (e.g. 5 € each) that doesn’t match the equal split.
- Someone joins or leaves mid-cycle and you agree on a different amount.

The member’s reminder will show their custom amount instead of the calculated one.

## Inviting members

For pending members, use one of these:

- **Resend invite** — Sends the standard email/notification invite again
- **Copy Telegram link** — Copies a member-specific `t.me/...start=invite_<token>` link you can send directly

Telegram invite links are especially useful when the app is hosted locally or behind a private network. Send the copied link itself to the member; asking them to type plain `/start` will only open the bot without the invite payload.
