---
name: see-ref-groups
description: Reference for the Groups + Members module — code map, entrypoints, conventions. Load explicitly when working on groups/members.
---

# Groups + Members module reference

## Purpose
A **Group** is one shared subscription (Netflix, YouTube Premium, …) owned by an admin who pays the bill. Members are **embedded subdocuments** (not a separate collection) and can be email-only, account-linked, or Telegram-only. The group carries billing config, payment method, notification settings, invite state, and announcements.

## Main functionalities
- Group CRUD (`POST/GET/PATCH/DELETE /api/groups`, soft-delete via `isActive: false`)
- Member CRUD with optional email; invite flow via public link or per-member Telegram deep-link
- Telegram-only member support (`email: null`, `userId: null`, only `telegram.chatId` on the linked user)
- Embedded share calculation hooks: roster/billing changes recalc all open periods
- Soft-delete of members (`leftAt` set, `isActive: false`) preserves billing history
- Custom per-member amounts that override mode defaults
- `billingStartsAt` enables backdating + automatic backfill into past periods
- Public invite link (`inviteCode` + `inviteLinkEnabled` toggle)

## Code map

### Domain types & models
- [src/lib/storage/types.ts](src/lib/storage/types.ts) — `StorageGroup`, `StorageGroupMember` (storage-agnostic; `id` is `nanoid` string)
- [src/models/group.ts](src/models/group.ts) — Mongoose `Group` schema, embedded `groupMemberSchema`

### API routes — groups
- [src/app/api/groups/route.ts](src/app/api/groups/route.ts) — GET list, POST create
- [src/app/api/groups/[groupId]/route.ts](src/app/api/groups/[groupId]/route.ts) — GET / PATCH / DELETE
- [src/app/api/groups/[groupId]/notifications/route.ts](src/app/api/groups/[groupId]/notifications/route.ts) — toggles + `saveEmailParams`

### API routes — members & invites
- [src/app/api/groups/[groupId]/members/route.ts](src/app/api/groups/[groupId]/members/route.ts) — POST add (with backfill)
- [src/app/api/groups/[groupId]/members/[memberId]/route.ts](src/app/api/groups/[groupId]/members/[memberId]/route.ts) — PATCH / DELETE
- [src/app/api/groups/[groupId]/members/[memberId]/send-invite/route.ts](src/app/api/groups/[groupId]/members/[memberId]/send-invite/route.ts)
- [src/app/api/groups/[groupId]/members/[memberId]/telegram-invite/route.ts](src/app/api/groups/[groupId]/members/[memberId]/telegram-invite/route.ts)
- [src/app/api/groups/[groupId]/invite-link/route.ts](src/app/api/groups/[groupId]/invite-link/route.ts) — generate / toggle / revoke
- [src/app/api/groups/join/route.ts](src/app/api/groups/join/route.ts) — public join via invite code

### Storage adapter
- [src/lib/storage/adapter.ts](src/lib/storage/adapter.ts) — group/member surface (`createGroup`, `getGroup`, `updateGroup`, `softDeleteGroup`, `listGroupsForUser`, `findGroupByInviteCode`, `findActiveGroupForMemberInvitation`)
- [src/lib/storage/mongoose-adapter.ts](src/lib/storage/mongoose-adapter.ts) — `groupToStorage()`, `memberToStorage()`
- [src/lib/storage/sqlite-adapter.ts](src/lib/storage/sqlite-adapter.ts) — JSON columns for `members[]`, `service{}`, `billing{}`, …

### UI components
- [src/components/features/groups/](src/components/features/groups) — `GroupCard`, `group-form`, `group-members-panel`, `group-detail-admin-actions`, `delete-group-button`, `invite-link-card`, `member-group-view`, `member-telegram-link`

## Key entrypoints
1. [src/app/api/groups/route.ts:54](src/app/api/groups/route.ts:54) — GET list (admin + member + email-match)
2. [src/app/api/groups/[groupId]/members/route.ts:20](src/app/api/groups/[groupId]/members/route.ts:20) — POST add member with billing backfill
3. [src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts:14](src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts:14) — dual auth (session OR portal JWT)
4. [src/lib/billing/calculator.ts:18](src/lib/billing/calculator.ts:18) — `calculateShares()` consumes the embedded member list
5. [src/app/api/groups/[groupId]/members/[memberId]/telegram-invite/route.ts:7](src/app/api/groups/[groupId]/members/[memberId]/telegram-invite/route.ts:7) — admin-copyable deep link

## Module-specific conventions
- Members are **embedded**; `member.id` is a `nanoid` (not ObjectId) — validate via `isStorageId()`.
- Active filter is **two conditions**: `m.isActive && !m.leftAt`. A removed member has both set.
- Email is normalized via `.toLowerCase().trim()` everywhere before lookup.
- Telegram-only members carry `email: null` + `userId: null`; the bridge is `telegram.chatId` on the *linked user*, established via the deep-link invite.
- `billingStartsAt` overrides `joinedAt` for share eligibility; admin can set in past (auto-backfill) or future.
- `customAmount` overrides mode defaults per member (not additive).
- Soft-delete pattern: keep history; `leftAt` + `isActive: false` is the canonical removal.

## Cross-cutting
- **Cron**: `check-billing-periods` reads `listAllActiveGroups()`; `enqueue-reminders` joins members → users for notification targeting
- **Notifications**: `recipientKey` aggregates by linked user → email → memberId so a Telegram-only member still gets one combined message
- **Auth scopes**: admin routes check `group.adminId === session.user.id`; member routes also accept `member.userId` or `member.email` matches; portal JWT bypasses session
- **Audit events**: `group_created/edited`, `member_added/updated/removed`

## Gotchas
- Embedded `member.id` is **not** a Mongoose ObjectId — never `new ObjectId(member.id)`.
- Recalc cascades from member CRUD touch every open period — slow on large groups.
- Invite-link `DELETE` clears both `inviteCode` and `inviteLinkEnabled`; existing links 404.
- `adminIncludedInSplit: true` adds the admin to the *divisor* but they don't appear in `members[]` and don't get a payment row.
- Telegram-invite tokens are HMAC-signed with a 7-day expiry — copy & paste only works inside that window.

## Related modules
- `see-ref-billing` — periods/shares depend on member roster
- `see-ref-notifications` — recipient resolution per channel
- `see-ref-storage` — embedded-member persistence in both adapters
- `see-ref-auth` — session vs portal JWT for member access

## Updating this ref
Append non-obvious gotchas or path moves you encounter. Keep additions terse and linked.
