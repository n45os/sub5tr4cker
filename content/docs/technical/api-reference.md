---
title: API Reference
description: REST API endpoints, auth, and response formats.
---

# API Reference

All API routes live under `/api/`. Protected routes require a valid Auth.js session. Cron routes require the `CRON_SECRET` header.

## Authentication

### `GET/POST /api/auth/[...nextauth]`

Auth.js catch-all. Handles sign-in, sign-out, session, and OAuth callbacks.

Providers: Credentials (email/password), Google OAuth.

## Groups

### `GET /api/groups`

List groups the authenticated user belongs to (admin or member).

**Response:** `{ "groups": [ { "_id", "name", "service", "role", "memberCount", "billing", "nextBillingDate", "unpaidCount" } ] }`

### `POST /api/groups`

Create a group. Body: `name`, `service`, `billing`, `payment`, `members`. Authenticated user becomes admin.

### `GET /api/groups/[groupId]`

Get group details. Admin sees full config; members see limited info.

### `PATCH /api/groups/[groupId]`

Update group. Admin only.

### `DELETE /api/groups/[groupId]`

Soft-deactivate group. Admin only.

## Members

### `POST /api/groups/[groupId]/members`

Add member. Body: `email`, `nickname`, `customAmount` (optional). Admin only.

### `PATCH /api/groups/[groupId]/members/[memberId]`

Update member. Admin only.

### `DELETE /api/groups/[groupId]/members/[memberId]`

Remove member (soft). Admin only.

## Billing

### `GET /api/groups/[groupId]/billing`

List billing periods. Query: `page`, `limit`, `status`.

### `POST /api/groups/[groupId]/billing`

Create billing period (e.g. variable mode). Admin only. Body: `periodLabel`, `totalPrice`, `periodStart`, `periodEnd`.

### `PATCH /api/groups/[groupId]/billing/[periodId]`

Update period (e.g. waive member, add notes). Admin only.

## Payment confirmation

### `GET /api/confirm/[token]`

Handles “I’ve paid” email link. Token is HMAC-signed. No auth. Validates token, sets payment to `member_confirmed`, notifies admin, redirects to a thank-you URL.

### `POST /api/groups/[groupId]/billing/[periodId]/confirm`

Admin confirms a member’s payment. Body: `memberId`, `action` (`confirm` | `reject`), `notes` (optional).

## Notifications

### `POST /api/groups/[groupId]/notify`

Trigger notifications manually. Body: `type`, `message`, `channels`. Admin only.

## Cron

### `POST /api/cron/billing`

Create billing periods for due groups. Header: `x-cron-secret: <CRON_SECRET>`.

### `POST /api/cron/reminders`

Send payment reminders. Header: `x-cron-secret: <CRON_SECRET>`.

## Error format

All errors use:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Common codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `INTERNAL_ERROR`.

## Success format

Successful responses use:

```json
{
  "data": { ... }
}
```

For the full request/response schemas and more endpoints, see `docs/api-design.md` in the repository.
