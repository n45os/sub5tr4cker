# Phase 6 — Remove Credentials + Magic-invite providers

## Goal
Once n450s is live and users are linked, the legacy NextAuth Credentials and Magic-invite providers become dead code. Remove them, drop the NextAuth handler entirely (advanced mode), and reroute the invite-acceptance flow through n450s.

## Scope
- Delete `src/app/api/auth/[...nextauth]/route.ts` (or convert to a 410 stub that points at the new flow).
- Strip the Credentials and MagicInvite providers from `src/lib/auth.ts`. Drop the `MongoDBAdapter` import. Remove `@auth/mongodb-adapter` from dependencies (keep `mongodb@^6` — it's still used elsewhere).
- Delete `src/app/api/register/route.ts` — registration now happens at n450s_auth (invite flow).
- Update `src/app/(auth)/register/page.tsx` to redirect to `${AUTH_SERVICE_URL}/signup?invite_code=...` (preserving any `?invite=` query param from email links).
- Update group invite emails (`src/lib/email/templates/group-invite.ts`) to point at `${AUTH_SERVICE_URL}/signup?invite_code=...&continue=<sub5tr4cker-deep-link>` instead of the magic-invite token URL.
- Adjust `src/lib/tokens.ts`: keep HMAC for *member portal* tokens (those are not auth tokens) and confirmation tokens. Remove `createMagicLoginToken` / `verifyMagicLoginToken`.
- Delete now-orphaned files (Credentials helpers, magic-invite helpers).
- Delete `bcryptjs` if no longer used (audit usages first).

## Scope OUT
- Local mode — still uses token-cookie auto-login.
- The login page UI — phase 7.

## Files to touch
- `src/app/api/auth/[...nextauth]/route.ts` (delete)
- `src/lib/auth.ts`
- `src/app/api/register/route.ts` (delete)
- `src/app/(auth)/register/page.tsx`
- `src/lib/email/templates/group-invite.ts`
- `src/lib/tokens.ts`
- `package.json` (remove `@auth/mongodb-adapter` and possibly `bcryptjs`, `next-auth`)

## Acceptance criteria
- [ ] No code references NextAuth in advanced mode.
- [ ] No code references the Credentials / Magic-invite providers.
- [ ] Existing protected routes still work (because `auth()` was rewritten in phase 4).
- [ ] Group-invite emails open the n450s signup flow.

## Manual verification
- `pnpm dev` → log in (n450s) → walk through admin and member group flows.
- Send a group invite to a new email → recipient lands on n450s signup → after signup, redirected back to sub5tr4cker.
- `pnpm test` green; `pnpm lint` clean.
