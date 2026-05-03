# Phase 8 — Tests + integration smoke results

## Unit tests (added)

- `src/lib/auth/n450s/session-resolver.test.ts` — 5 cases.
  - full payload → `Session` (sub → user.id, email/name/picture/role mapped, exp → ISO string).
  - missing role defaults to `"user"`.
  - missing email/name/picture surface as `null`.
  - empty-string email/name/picture surface as `null`.
  - missing `exp` falls back to a near-future expiry (within ~60s).
- `src/lib/auth/n450s/session-cookies.test.ts` — 7 cases covering `setSessionTokens`, `readSessionTokens`, `clearSessionTokens` over a real `NextRequest` / `NextResponse` round-trip.
  - access + refresh cookies write with `httpOnly`, `sameSite=lax`, `path=/`.
  - access cookie max-age derived from `expiresAt`.
  - access cookie clamped to a 60s minimum when `expiresAt` is in the past.
  - refresh cookie always uses the 7-day max-age.
  - round-trip: tokens written to a response can be read from a follow-up request that carries them as Cookie header.
  - empty request → both tokens undefined.
  - `clearSessionTokens` writes empty values with `maxAge=0`.
- `src/middleware.test.ts` — 10 cases. All n450s helpers (`verifyAccessToken`, `refreshTokens`) are mocked.
  - **valid AT** → pass through, `x-pathname` header set, `refreshTokens` not called, no cookies rewritten.
  - **expired AT + valid RT on protected path** → silent refresh, new AT/RT cookies written, no redirect.
  - **missing AT + valid RT** → silent refresh without calling `verifyAccessToken`.
  - **expired AT + expired RT on protected path** → 307 to `/login` with `callbackUrl=%2Fdashboard%2Fgroups`, both cookies cleared.
  - **no tokens on `/`** → 307 to `/login`.
  - **no tokens on `/api/groups`** (non-protected) → pass through.
  - **`/api/auth/n450s/callback`** → never invokes auth helpers.
  - **query string preservation** in `callbackUrl` for redirected protected pages.
  - **local mode** → n450s helpers never called.
  - **local mode `/login` redirect** → 307 to `/dashboard` when local auth cookie is already set.

## Test run

`pnpm test -- src/middleware.test.ts src/lib/auth/n450s/session-cookies.test.ts src/lib/auth/n450s/session-resolver.test.ts`

```
Test Files  16 passed (16)
Tests       93 passed (93)
Duration    ~1.0s
```

All 22 newly-added cases pass; all 71 pre-existing tests still pass.

## Integration smoke checklist

> Status: **not yet executed.** Requires a running n450s_auth instance on `:3045`, a registered `sub5tr4cker` OAuth client, and `pnpm dev` for advanced mode plus `s54r start` for local mode. The brief defines this as a manual walk; the operator should record outcomes in the table below before phase 9.

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | First-time login via n450s creates a User | n450s consent → callback → `User.authIdentityId` set, redirect to `/dashboard` | _pending operator run_ |
| 2 | Existing User logs in and lands on their groups | callback resolves existing User by `authIdentityId` (or links by email), `/dashboard` lists their groups | _pending operator run_ |
| 3 | Access token expires → silent refresh → no redirect | request to `/dashboard` with expired AT and valid RT rewrites both cookies and renders the page | _pending operator run_ |
| 4 | Refresh token revoked → next request redirects to login | expired AT + revoked RT → 307 to `/login?callbackUrl=...`, cookies cleared | _pending operator run_ |
| 5 | Sign-out clears cookies and redirects to n450s `/oauth/logout` | sidebar sign-out → `/api/auth/n450s/logout` → 307 to n450s logout, `s5_at`/`s5_rt` removed | _pending operator run_ |
| 6 | Local mode untouched (`SUB5TR4CKER_MODE=local pnpm dev`) | dashboard works end-to-end, no n450s calls; sign-out is a known no-op (phase-7 carryover) | _pending operator run_ |

## Carryovers / notes

- The smoke walk is operator-driven (needs a running n450s_auth instance + a real OAuth client secret). The unit-test layer is sufficient to prove the decision matrix; the smoke walk verifies wiring and copy at the edges and is deferred to the cutover (phase 9) operator.
- Phase 3/7 carryovers still present and not in this brief's "Files to touch":
  - the n450s callback route's `setSessionTokens` is still a no-op stub — login does not yet persist cookies end-to-end. Smoke item #1 will fail until that lands.
  - local-mode `/api/auth/n450s/logout` throws when n450s env vars are unset; smoke item #6's sign-out is the documented no-op.
  - `src/app/(auth)/invite-callback/page.tsx` still imports `signIn from "next-auth/react"` and will break at runtime. Surfaced here per the brief's request to flag missing wiring; fixing it is out of this brief's allowlist.
- All three test files use the real `NextRequest`/`NextResponse` from `next/server` (no Web Request shim needed — Node 20 has Request/Response globals); the middleware test mocks only `verifyAccessToken` and `refreshTokens`, leaving cookie/redirect behavior under real test.
