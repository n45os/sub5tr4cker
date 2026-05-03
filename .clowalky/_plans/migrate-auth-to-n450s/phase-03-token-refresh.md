# Phase 3 — Token storage + middleware refresh (sliding sessions)

## Goal
Persist access + refresh tokens on the user's browser as HttpOnly cookies and implement transparent refresh in middleware. This is the phase that **delivers "sessions are persistent"** — n450s_auth refresh tokens use sliding expiry, so as long as middleware refreshes silently when the access token expires, the user stays logged in indefinitely while active.

## Scope
- New `src/lib/auth/n450s/session-cookies.ts`:
  - `setSessionTokens(res, { accessToken, refreshToken, expiresAt })` — writes two HttpOnly, Secure, SameSite=Lax cookies (`s5_at`, `s5_rt`) with appropriate Max-Age (access ≈ 1h, refresh ≈ 7d as advertised by n450s but extended on use).
  - `readSessionTokens(req)` and `clearSessionTokens(res)`.
  - Use Next's `cookies()` API in a route-handler-safe way.
- Update `src/middleware.ts` (advanced mode branch):
  - On every protected request:
    1. Read `s5_at`. If present and `verifyAccessToken` succeeds → continue.
    2. If `s5_at` missing/expired and `s5_rt` exists → call `refreshTokens(refreshToken)`, set new cookies, continue.
    3. If both missing → redirect to `/login` (which will hand off to `/api/auth/n450s/login`).
  - Local mode branch is **unchanged** (still uses `sub5tr4cker-local-auth`).
- Add a small in-memory cache (per-process) for verified access-token payloads keyed by token string with a short TTL (≤30s) to avoid re-verifying on every chained `auth()` call within the same request.

## Scope OUT
- The `auth()` wrapper rewrite — phase 4.
- User-row linking — phase 5.

## Files to touch
- `src/lib/auth/n450s/session-cookies.ts`
- `src/middleware.ts`
- `src/lib/auth/n450s/payload-cache.ts`

## Acceptance criteria
- [ ] After login, `s5_at` and `s5_rt` cookies exist (HttpOnly, Secure, SameSite=Lax).
- [ ] When the access token expires mid-session, the next request triggers a silent refresh — no redirect to login.
- [ ] When the refresh token finally expires (or is revoked), the user is redirected to login.
- [ ] Local mode is byte-for-byte unchanged in middleware behavior.

## Manual verification
- `pnpm dev` → log in → check cookies in devtools (HttpOnly + Secure flags set; cookies persist across browser restart).
- Set the access-token TTL very short on n450s side (or wait an hour) → confirm refresh happens silently.
- Revoke the refresh token via n450s admin → next request redirects to login.
- `pnpm lint` clean.
