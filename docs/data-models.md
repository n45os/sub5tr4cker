# Data Models

## Entity Relationship Overview

```
User ──┬── owns ──── Group ──── has many ──── BillingPeriod
       │                │                         │
       │                ├── has many ── Member     ├── MemberPayment[]
       │                │              (embedded)  │   (embedded)
       │                └── has many ── PriceHistory
       │
       └── receives ── Notification
```

## User

The person using the platform. Can be an admin (group owner) or a member of groups.

```typescript
{
  _id: ObjectId,
  name: string,
  email: string,                          // unique, used for auth
  emailVerified: Date | null,
  image: string | null,                   // avatar URL
  hashedPassword: string | null,          // null if using OAuth only

  // notification channels
  telegram: {
    chatId: number | null,                // set when user links their Telegram
    username: string | null,
    linkedAt: Date | null,
  },
  notificationPreferences: {
    email: boolean,                       // default: true
    telegram: boolean,                    // default: false (until linked)
    reminderFrequency: 'once' | 'daily' | 'every_3_days',  // default: 'every_3_days'
  },

  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes**: `email` (unique), `telegram.chatId` (sparse unique)

## Group

A subscription group managed by an admin.

```typescript
{
  _id: ObjectId,
  name: string,                           // e.g., "YouTube Premium Family"
  description: string | null,
  admin: ObjectId,                        // ref: User

  // subscription details
  service: {
    name: string,                         // e.g., "YouTube Premium"
    icon: string | null,                  // URL or emoji
    url: string | null,                   // service URL
  },

  // billing configuration
  billing: {
    mode: 'equal_split' | 'fixed_amount' | 'variable',
    currentPrice: number,                 // current total price per period
    currency: string,                     // default: 'EUR'
    cycleDay: number,                     // day of month billing occurs (1-28)
    cycleType: 'monthly' | 'yearly',      // default: 'monthly'
    adminIncludedInSplit: boolean,         // does the admin pay a share too?
    fixedMemberAmount: number | null,     // only for 'fixed_amount' mode
    gracePeriodDays: number,              // days before first reminder (default: 3)
  },

  // payment method
  payment: {
    platform: 'revolut' | 'paypal' | 'bank_transfer' | 'stripe' | 'custom',
    link: string | null,                  // e.g., "https://revolut.me/example"
    instructions: string | null,          // free text for bank transfer, etc.
    stripeAccountId: string | null,       // for Stripe integration (phase 2)
  },

  notifications: {
    remindersEnabled: boolean,            // default: true
    followUpsEnabled: boolean,            // default: true
    priceChangeEnabled: boolean,          // default: true
  },

  // members (embedded for performance — groups rarely exceed 20 members)
  members: [{
    user: ObjectId | null,                // ref: User (null if email-only)
    email: string,                        // always present
    nickname: string,                     // display name in the group
    role: 'member' | 'admin',
    joinedAt: Date,
    leftAt: Date | null,                  // soft delete
    isActive: boolean,
    customAmount: number | null,          // override for this member (if not equal split)
  }],

  // communication
  announcements: {
    notifyOnPriceChange: boolean,         // default: true
    extraText: string | null,             // custom text appended to emails
  },

  // telegram group (optional)
  telegramGroup: {
    chatId: number | null,
    linkedAt: Date | null,
  },

  isActive: boolean,                      // soft delete
  inviteCode: string | null,              // for public invite links

  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes**: `admin` (ref), `members.user` (ref), `members.email`, `inviteCode` (sparse unique)

## BillingPeriod

One billing cycle for a group. Created automatically by the cron job or manually.

```typescript
{
  _id: ObjectId,
  group: ObjectId,                        // ref: Group
  periodStart: Date,                      // start of billing period
  periodEnd: Date,                        // end of billing period
  periodLabel: string,                    // e.g., "Mar 2026"
  totalPrice: number,                     // total price for this period
  currency: string,

  // per-member payment tracking
  payments: [{
    memberId: ObjectId,                   // matches group.members._id
    memberEmail: string,                  // denormalized for convenience
    memberNickname: string,               // denormalized
    amount: number,                       // this member's share
    status: 'pending' | 'member_confirmed' | 'confirmed' | 'overdue' | 'waived',
    memberConfirmedAt: Date | null,
    adminConfirmedAt: Date | null,
    confirmationToken: string | null,     // for email "I paid" links
    notes: string | null,                 // admin can add notes
  }],

  // reminder tracking
  reminders: [{
    sentAt: Date,
    channel: 'email' | 'telegram',
    recipientCount: number,
    type: 'initial' | 'follow_up',
  }],

  // metadata
  isFullyPaid: boolean,                   // computed: all payments confirmed
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes**: `group` + `periodStart` (compound unique), `payments.status`, `payments.confirmationToken` (sparse)

## PriceHistory

Tracks price changes for a group over time.

```typescript
{
  _id: ObjectId,
  group: ObjectId,                        // ref: Group
  price: number,                          // new price
  previousPrice: number | null,           // old price
  currency: string,
  effectiveFrom: Date,                    // when this price takes effect
  note: string | null,                    // admin explanation
  membersNotified: boolean,               // whether announcement was sent
  createdBy: ObjectId,                    // ref: User (admin)

  createdAt: Date,
}
```

**Indexes**: `group` + `effectiveFrom` (compound)

## Notification

Log of all notifications sent. Useful for debugging and user history.

```typescript
{
  _id: ObjectId,
  recipient: ObjectId | null,            // ref: User (null for email-only members)
  recipientEmail: string,
  group: ObjectId | null,                // ref: Group
  billingPeriod: ObjectId | null,        // ref: BillingPeriod

  type: 'payment_reminder'
      | 'payment_confirmed'
      | 'admin_confirmation_request'
      | 'price_change'
      | 'announcement'
      | 'invite'
      | 'follow_up',

  channel: 'email' | 'telegram',
  status: 'sent' | 'failed' | 'pending',

  // content snapshot
  subject: string | null,                // for email
  preview: string,                       // short text preview

  // delivery metadata
  externalId: string | null,             // Resend message ID, Telegram message ID
  error: string | null,                  // if failed
  deliveredAt: Date | null,

  createdAt: Date,
}
```

**Indexes**: `recipient`, `group`, `type`, `createdAt` (TTL index optional — auto-delete after 90 days)

## Settings

Runtime configuration stored in MongoDB so app operators can manage integrations
from the dashboard instead of editing env files.

```typescript
{
  _id: ObjectId,
  key: string,                            // e.g. "email.apiKey"
  value: string | null,                   // encrypted for secret values when saved from the app
  category: 'general' | 'email' | 'telegram' | 'security' | 'cron',
  isSecret: boolean,
  label: string,
  description: string,
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes**: `key` (unique), `category`

## MemberRequest

Requests from members to admins (future feature).

```typescript
{
  _id: ObjectId,
  group: ObjectId,                        // ref: Group
  fromUser: ObjectId,                     // ref: User
  type: 'add_member' | 'remove_self' | 'change_info' | 'other',
  message: string,
  status: 'pending' | 'approved' | 'rejected',
  adminResponse: string | null,
  resolvedAt: Date | null,

  createdAt: Date,
}
```

## Confirmation Token Structure

Tokens embedded in email "I paid" links use HMAC-SHA256:

```
payload = {
  memberId: string,
  periodId: string,
  groupId: string,
  exp: number          // expiry timestamp (7 days from creation)
}

token = base64url(JSON.stringify(payload)) + "." + hmac_sha256(payload, SECRET)
```

The token is validated by recomputing the HMAC and checking expiry. No database lookup needed for validation — only for the actual confirmation action.
