# Phase 5 — User row linking (`User.authIdentityId = sub`)

## Goal
Map every n450s identity (`sub`) to a local `User` document. New users land via the callback flow — auto-provision a `User` row keyed on `sub`. Existing users get a one-shot migration that links their `User._id` to a matching `sub` based on email.

## Scope
- Update `src/models/user.ts`: add `authIdentityId: string | null` (sparse unique index when set). Keep `email` for legacy lookups, but `authIdentityId` is now the primary identity bridge.
- Update `src/lib/storage/types.ts` `StorageUser`: add `authIdentityId`.
- Update both adapters (`mongoose-adapter.ts`, `sqlite-adapter.ts`) to read/write the field. Local mode never sets it (local users are not federated).
- New adapter method: `getUserByAuthIdentityId(sub: string): Promise<StorageUser | null>`.
- In the n450s callback (phase 2): after token exchange + verification, look up `User` by `authIdentityId`. If missing, look up by email and link. If still missing, auto-create a new user with `name`, `email`, `authIdentityId`, default notification prefs.
- Migration script `scripts/link-existing-users-to-n450s.ts`:
  - Reads all users from the local DB.
  - For each user with no `authIdentityId`, queries n450s admin API (`GET /admin/api/users-sync` or similar — see n450s integration guide) to find an `AuthIdentity` whose `email` matches.
  - Sets `authIdentityId`.
  - Reports unmatched users (so the operator can manually invite them).

## Scope OUT
- Removing legacy auth providers — phase 6.

## Files to touch
- `src/models/user.ts`
- `src/lib/storage/types.ts`
- `src/lib/storage/mongoose-adapter.ts`
- `src/lib/storage/sqlite-adapter.ts`
- `src/lib/storage/adapter.ts` (interface)
- `src/app/api/auth/n450s/callback/route.ts`
- `scripts/link-existing-users-to-n450s.ts`

## Acceptance criteria
- [ ] First-time login via n450s creates a fresh `User` row with `authIdentityId` set.
- [ ] Existing user (post-migration) logs in and lands on their existing `User` row (with all groups intact).
- [ ] Migration script is idempotent.
- [ ] Unmatched-users report is human-readable.

## Manual verification
- Create a test n450s identity with a never-seen email → log in → new `User` row exists with `authIdentityId`.
- Run migration script in dry-run → see expected matches.
- Run with `--apply` → re-run is a no-op.
- `pnpm test` green.
