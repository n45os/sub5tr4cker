# API Design

All API routes live under `src/app/api/`. Protected routes require a valid Auth.js session. Cron routes require a `CRON_SECRET` header.

## Authentication

### `GET/POST /api/auth/[...nextauth]`

Auth.js catch-all route. Handles sign-in, sign-out, session, and callback flows.

Configured providers:
- Credentials (email + password)
- Google OAuth
- Magic link (email)

## Groups

### `GET /api/groups`

List all groups the authenticated user belongs to (as admin or member).

**Response:**
```json
{
  "groups": [
    {
      "_id": "...",
      "name": "YouTube Premium Family",
      "service": { "name": "YouTube Premium", "icon": "🎬" },
      "role": "admin",
      "memberCount": 5,
      "billing": { "currentPrice": 18, "currency": "EUR", "mode": "equal_split" },
      "nextBillingDate": "2026-04-03",
      "unpaidCount": 2
    }
  ]
}
```

### `POST /api/groups`

Create a new subscription group. Authenticated user becomes the admin.

**Body:**
```json
{
  "name": "YouTube Premium Family",
  "service": { "name": "YouTube Premium", "accentColor": "#3b82f6" },
  "billing": {
    "mode": "equal_split",
    "currentPrice": 18,
    "currency": "EUR",
    "cycleDay": 3,
    "cycleType": "monthly",
    "adminIncludedInSplit": true,
    "gracePeriodDays": 3
  },
  "payment": {
    "platform": "revolut",
    "link": "https://revolut.me/example"
  },
  "members": [
    { "email": "alice@example.com", "nickname": "Alice" },
    { "email": "bob@example.com", "nickname": "Bob" }
  ]
}
```

### `GET /api/groups/[groupId]`

Get full group details. Admin sees everything, members see limited info.

### `PATCH /api/groups/[groupId]`

Update group settings. Admin only.

The editable payload covers general details, service (including optional
`service.accentColor` hex for notification email branding), billing configuration,
payment instructions, and the values used by the dashboard edit flow.

### `DELETE /api/groups/[groupId]`

Deactivate (soft delete) a group. Admin only.

### `PATCH /api/groups/[groupId]/notifications`

Update per-group notification toggles. Admin only.

**Body:**
```json
{
  "remindersEnabled": true,
  "followUpsEnabled": true,
  "priceChangeEnabled": true
}
```

## Members

### `POST /api/groups/[groupId]/members`

Add a member to the group. Admin only. Sends invite email.

**Body:**
```json
{
  "email": "newmember@example.com",
  "nickname": "New Member",
  "customAmount": null
}
```

### `PATCH /api/groups/[groupId]/members/[memberId]`

Update member details (nickname, custom amount, active status). Admin only.

### `DELETE /api/groups/[groupId]/members/[memberId]`

Remove a member (soft delete — sets `leftAt` and `isActive: false`). Admin only.

## Invite link (self-join)

Admins can share a link so others can join the group without being added manually. Joining does not require login. The admin can lock registration or revoke the link at any time.

### `GET /api/groups/[groupId]/invite-link`

Get current invite-link status and URL. Admin only.

**Response:**
```json
{
  "data": {
    "inviteLinkEnabled": true,
    "inviteCode": "abc12XYZ",
    "inviteUrl": "https://app.example.com/invite/abc12XYZ"
  }
}
```

When no link exists, `inviteCode` and `inviteUrl` are `null`, and `inviteLinkEnabled` is `false`.

### `POST /api/groups/[groupId]/invite-link`

Generate or rotate the invite code and enable the link. Admin only. Returns the new invite URL.

### `PATCH /api/groups/[groupId]/invite-link`

Toggle whether registration via the link is allowed. Admin only.

**Body:**
```json
{
  "enabled": true
}
```

Set `enabled: false` to lock registration (link stays valid but no one can join until re-enabled). Set `enabled: true` to allow joining again.

### `DELETE /api/groups/[groupId]/invite-link`

Revoke the invite link (clear code and disable). Admin only. The previous link stops working.

### `GET /api/invite/[inviteCode]`

Public. Resolve an invite code and return group preview plus whether joining is currently allowed. No auth.

**Response (success):**
```json
{
  "data": {
    "groupId": "...",
    "name": "YouTube Premium Family",
    "description": null,
    "service": { "name": "YouTube Premium", "icon": null, "url": null },
    "billing": { "currentPrice": 18, "currency": "EUR", "cycleType": "monthly" },
    "canJoin": true,
    "inviteLinkEnabled": true
  }
}
```

**Error codes:** `INVITE_INVALID` (code not found or revoked), `GROUP_INACTIVE`.

### `POST /api/groups/join`

Public. Join a group via invite code. No auth. Body must include the invite code, email, and nickname.

**Body:**
```json
{
  "inviteCode": "abc12XYZ",
  "email": "newmember@example.com",
  "nickname": "New Member"
}
```

**Response (success):**
```json
{
  "data": {
    "groupId": "...",
    "member": {
      "_id": "...",
      "email": "newmember@example.com",
      "nickname": "New Member",
      "role": "member",
      "isActive": true
    }
  }
}
```

**Error codes:** `VALIDATION_ERROR`, `INVITE_INVALID`, `GROUP_INACTIVE`, `INVITE_DISABLED` (registration via link is locked), `ALREADY_MEMBER` (email already in group).

## Billing Periods

### `GET /api/groups/[groupId]/billing`

List billing periods for a group. Supports pagination and filtering.

**Query params:** `?page=1&limit=12&status=pending`

**Response:**
```json
{
  "periods": [
    {
      "_id": "...",
      "periodLabel": "Mar 2026",
      "totalPrice": 18,
      "payments": [
        {
          "memberId": "...",
          "memberNickname": "vasiliki",
          "amount": 3,
          "status": "pending"
        }
      ],
      "isFullyPaid": false
    }
  ],
  "pagination": { "page": 1, "totalPages": 3, "total": 30 }
}
```

### `POST /api/groups/[groupId]/billing`

Manually create a billing period (for variable mode). Admin only.

**Body:**
```json
{
  "periodLabel": "Mar 2026",
  "totalPrice": 22.50,
  "periodStart": "2026-03-01",
  "periodEnd": "2026-03-31"
}
```

### `PATCH /api/groups/[groupId]/billing/[periodId]`

Update a billing period (change price, waive a member, add notes). Admin only.

## Payment Confirmation

### `POST /api/confirm/[token]`

Email "I paid" handler. The token is a signed payload containing memberId, periodId, groupId. No authentication required (the token itself is the auth).

**Flow:**
1. Validate HMAC signature and expiry
2. Find the billing period and member payment
3. Set status to `member_confirmed`
4. Notify admin via preferred channel
5. Redirect to a "thank you" page

**Response:** Redirect to `/confirmed?group=...&period=...`

### `POST /api/groups/[groupId]/billing/[periodId]/confirm`

Admin confirms a member's payment. Admin only.

**Body:**
```json
{
  "memberId": "...",
  "action": "confirm" | "reject",
  "notes": "Received via Revolut"
}
```

### `POST /api/groups/[groupId]/billing/[periodId]/self-confirm`

Authenticated member confirms their own payment (alternative to email token).

## Notifications

### `POST /api/groups/[groupId]/notify`

Manually trigger notifications for a group. Admin only.

**Body:**
```json
{
  "type": "payment_reminder" | "announcement" | "price_change",
  "message": "Optional custom message",
  "channels": ["email", "telegram"]
}
```

### `GET /api/notifications`

List notifications for the authenticated user. Supports pagination.

### `GET /api/notifications?groupId=<id>&limit=<n>`

List recent notifications for a specific group.

### `GET /api/notifications/templates`

Return the notification template registry, including email and Telegram previews.

### `GET /api/notifications/templates/[type]/preview`

Return a single template preview with HTML, Telegram text, and variable metadata.

## Price Changes

### `POST /api/groups/[groupId]/price`

Record a price change. Admin only.

**Body:**
```json
{
  "price": 24,
  "effectiveFrom": "2026-04-01",
  "note": "YouTube increased the family plan price",
  "notifyMembers": true
}
```

## Telegram

### `POST /api/telegram/webhook`

Telegram webhook endpoint (alternative to polling). Receives updates from Telegram Bot API. Protected by `X-Telegram-Bot-Api-Secret-Token`.

### `POST /api/telegram/link`

Generate a Telegram linking token for the authenticated user. Returns a deep link to the bot.

**Response:**
```json
{
  "botUsername": "SubsTrackBot",
  "deepLink": "https://t.me/SubsTrackBot?start=link_abc123"
}
```

## Cron Jobs

### `POST /api/cron/billing`

Create billing periods for subscriptions that are due. Protected by `CRON_SECRET`.

### `POST /api/cron/reminders`

Send payment reminders for unpaid billing periods. Protected by `CRON_SECRET`.

### `POST /api/cron/follow-ups`

Send follow-up reminders and admin nudges. Protected by `CRON_SECRET`.

## User Settings

### `GET /api/user/settings`

Get authenticated user's profile and notification preferences.

### `PATCH /api/user/settings`

Update profile and notification preferences.

**Body:**
```json
{
  "name": "Nassos",
  "notificationPreferences": {
    "email": true,
    "telegram": true,
    "reminderFrequency": "every_3_days"
  }
}
```

## App Settings

### `GET /api/settings`

List the runtime settings stored in MongoDB.

### `PATCH /api/settings`

Bulk update runtime settings.

### `POST /api/settings/test-email`

Send a test email to the authenticated user.

### `POST /api/settings/test-telegram`

Send a test Telegram message to the authenticated user if their Telegram account
is already linked.

## Member Requests (Phase 2)

### `POST /api/groups/[groupId]/requests`

Submit a request to the group admin. Member only.

### `GET /api/groups/[groupId]/requests`

List requests for a group. Admin sees all, members see own.

### `PATCH /api/groups/[groupId]/requests/[requestId]`

Approve or reject a request. Admin only.

## Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": {}
  }
}
```

Common codes:
- `UNAUTHORIZED` — not authenticated
- `FORBIDDEN` — not authorized for this action
- `NOT_FOUND` — resource not found
- `VALIDATION_ERROR` — request body validation failed
- `CONFLICT` — duplicate resource (e.g. `ALREADY_MEMBER` for join)
- `INVITE_INVALID` — invite code not found or revoked
- `INVITE_DISABLED` — registration via invite link is currently locked
- `GROUP_INACTIVE` — group is deactivated
- `RATE_LIMITED` — too many requests
- `INTERNAL_ERROR` — server error
