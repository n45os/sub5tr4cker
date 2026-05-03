# Phase 4 — Rewrite `auth()` around n450s tokens

## Goal
The single `auth()` function in `src/lib/auth.ts` is called by every protected route. Make the advanced-mode branch resolve sessions from n450s tokens (via the cookies + JWKS verification from phase 3). Keep the local-mode branch identical.

## Scope
- Refactor `src/lib/auth.ts`:
  - In advanced mode: `auth()` reads `s5_at` cookie → `verifyAccessToken` → maps the payload to the same session shape we use today: `{ user: { id, email, name, image, role }, expires }`. The `id` is the local `User._id` we resolve via `User.authIdentityId === sub` (phase 5 maintains this link). Until phase 5 lands, fall back to `sub` itself as a temporary id (mark with TODO).
  - In local mode: unchanged.
- Drop the call to NextAuth in advanced mode; the route `/api/auth/[...nextauth]` becomes a stub returning 410 (gone) — final removal in phase 6.
- Update the session callback expectations: any code that does `await auth()` should still work because the return shape is identical.

## Scope OUT
- Removing the Credentials / Magic-invite providers — phase 6.
- The `User.authIdentityId` model field — phase 5.

## Files to touch
- `src/lib/auth.ts`
- `src/lib/auth/n450s/session-resolver.ts` (NEW — pure mapping function)

## Acceptance criteria
- [ ] `auth()` returns a session built from the n450s access token in advanced mode.
- [ ] All existing route handlers continue to work without changes (because the session shape is preserved).
- [ ] Local mode is unaffected.
- [ ] No code path calls NextAuth in advanced mode.

## Manual verification
- `pnpm dev` → log in via n450s → visit `/api/groups` → returns the user's groups (proves `auth()` resolved correctly).
- `pnpm test` green.
- `pnpm lint` clean.
