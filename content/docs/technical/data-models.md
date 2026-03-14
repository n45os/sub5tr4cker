---
title: Data Models
description: Mongoose schemas and entity relationships.
---

# Data Models

## Entity relationship

```
User ──┬── owns ──── Group ──── has many ──── BillingPeriod
       │                │                         │
       │                ├── has many ── Member     ├── MemberPayment[]
       │                │   (embedded)             │   (embedded)
       │                └── has many ── PriceHistory
       │
       └── receives ── Notification
```

## User

- **Fields**: name, email (unique), emailVerified, image, hashedPassword, telegram (chatId, username, linkedAt), notificationPreferences (email, telegram, reminderFrequency), timestamps.
- **Indexes**: email (unique), telegram.chatId (sparse unique).

## Group

- **Fields**: name, description, admin (ref User), service (name, icon, url), billing (mode, currentPrice, currency, cycleDay, cycleType, adminIncludedInSplit, fixedMemberAmount, gracePeriodDays), payment (platform, link, instructions, stripeAccountId), members (array of { user, email, nickname, role, joinedAt, leftAt, isActive, customAmount }), announcements (notifyOnPriceChange, extraText), telegramGroup (chatId, linkedAt), isActive, inviteCode, timestamps.
- **Indexes**: admin, members.user, members.email, inviteCode (sparse unique).

## BillingPeriod

- **Fields**: group (ref), periodStart, periodEnd, periodLabel, totalPrice, currency, payments (array of { memberId, memberEmail, memberNickname, amount, status, memberConfirmedAt, adminConfirmedAt, confirmationToken, notes }), reminders (array of { sentAt, channel, recipientCount, type }), isFullyPaid, timestamps.
- **Payment statuses**: pending, member_confirmed, confirmed, overdue, waived.
- **Indexes**: (group, periodStart) unique, payments.status, payments.confirmationToken (sparse).

## PriceHistory

- **Fields**: group (ref), price, previousPrice, currency, effectiveFrom, note, membersNotified, createdBy (ref User), timestamps.
- **Index**: (group, effectiveFrom).

## Notification

- **Fields**: recipient (ref User), recipientEmail, group (ref), billingPeriod (ref), type, channel (email | telegram), status (sent | failed | pending), subject, preview, externalId, error, deliveredAt, timestamps.
- **Types**: payment_reminder, payment_confirmed, admin_confirmation_request, price_change, announcement, invite, follow_up.

## Confirmation token

Used in “I’ve paid” email links. Payload: `memberId`, `periodId`, `groupId`, `exp`. Signed with HMAC-SHA256; no DB lookup needed to validate.

Full schema definitions and indexes are in `src/models/` and `docs/data-models.md` in the repo.
