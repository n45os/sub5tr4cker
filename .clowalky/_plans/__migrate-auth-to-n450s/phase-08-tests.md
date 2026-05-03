# Phase 8 — Tests + integration smoke

## Goal
Lock down auth correctness before cutover. A mix of unit tests for the new helpers and a manual integration walk against a local n450s_auth instance.

## Scope
- Unit tests for:
  - `verifyAccessToken` (already in phase 1) — extend with realistic payloads.
  - `session-resolver.ts` (mapping JWT → `Session`).
  - `setSessionTokens` / `readSessionTokens` — round-trip a request/response with a fake cookie store.
  - Middleware decision matrix: missing access token + valid refresh, expired access token + expired refresh, both missing, etc.
- Integration smoke checklist (run locally with n450s_auth on `:3045`):
  - First-time login via n450s creates a User.
  - Existing User logs in and lands on their groups.
  - Access token expires → silent refresh → no redirect.
  - Refresh token revoked → next request redirects to login.
  - Sign-out clears cookies and redirects to n450s `/oauth/logout`.
  - Local mode untouched: `SUB5TR4CKER_MODE=local pnpm dev` still works end-to-end.
- Capture results in `phase-08-results.md`.

## Scope OUT
- Production cutover — phase 9.

## Files to touch
- `src/middleware.test.ts` (NEW — covers the decision matrix; uses a stub `verifyAccessToken`)
- `src/lib/auth/n450s/session-resolver.test.ts`
- `src/lib/auth/n450s/session-cookies.test.ts`
- `.clowalky/_plans/migrate-auth-to-n450s/phase-08-results.md`

## Acceptance criteria
- [ ] All new tests pass.
- [ ] All existing tests still pass.
- [ ] Smoke checklist pass/fail captured.

## Manual verification
- `pnpm test` green.
- Smoke walk completed and recorded.
