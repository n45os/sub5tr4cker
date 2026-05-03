# Phase 2 — Login + callback routes

## Goal
Implement the OAuth authorization-code flow: a `/api/auth/n450s/login` route that redirects users to n450s_auth's `/oauth/consent`, and a `/api/auth/n450s/callback` route that exchanges the code, validates the token, and sets session cookies.

## Scope
- New `src/app/api/auth/n450s/login/route.ts`:
  - Generates `state` (CSRF) and `code_verifier` / `code_challenge` (PKCE S256).
  - Stores them in a signed, HttpOnly cookie (short TTL — 10 min).
  - Redirects to `${AUTH_SERVICE_URL}/oauth/consent` with `client_id`, `redirect_uri`, `response_type=code`, `scope=openid profile email`, `state`, `code_challenge`, `code_challenge_method=S256`.
  - Accepts optional `?callbackUrl=` and round-trips it via `state`.
- New `src/app/api/auth/n450s/callback/route.ts`:
  - Verifies `state` matches the cookie.
  - Calls `exchangeCodeForTokens(code, codeVerifier)`.
  - Validates the access token via `verifyAccessToken`.
  - Calls `getUserinfo` if needed to fill `email` / `name` / `preferred_username`.
  - Hands off to phase 3's `setSessionTokens(...)` (stub it for now — phase 3 implements).
  - Redirects to `callbackUrl || /dashboard`.
- New `src/app/api/auth/n450s/logout/route.ts`:
  - Clears local session cookies.
  - Redirects to `${AUTH_SERVICE_URL}/oauth/logout?post_logout_redirect_uri=...`.

## Scope OUT
- The actual cookie writes (placeholder calls into phase 3 helpers).
- Replacing the existing `[...nextauth]` route — phase 6.

## Files to touch
- `src/app/api/auth/n450s/login/route.ts`
- `src/app/api/auth/n450s/callback/route.ts`
- `src/app/api/auth/n450s/logout/route.ts`

## Acceptance criteria
- [ ] Hitting `/api/auth/n450s/login` redirects to n450s_auth consent with PKCE.
- [ ] Returning to `/callback` with valid code completes the exchange and redirects.
- [ ] State mismatch returns a 400 with no token write.

## Manual verification
- Stand up n450s_auth locally on `:3045`.
- `pnpm dev` → visit `/api/auth/n450s/login` → land on n450s consent → approve → land back on `/dashboard` (or 200 placeholder once phase 3 is integrated).
- `pnpm lint` clean.
