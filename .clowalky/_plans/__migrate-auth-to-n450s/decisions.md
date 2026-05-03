# Auth migration — decisions (phase 0)

Pinning down what "use n450s_auth" means for sub5tr4cker, ahead of phases 1+. Local mode (`SUB5TR4CKER_MODE=local`) is **out of scope across this entire plan** — it stays on the existing token-cookie auto-login path (`src/lib/auth/local.ts`).

## Integration pattern

**Pattern 1 — Confidential client.** sub5tr4cker is a server-rendered Next.js app (App Router on port 3054), not a SPA. The token exchange and all refresh calls happen server-side, so we can hold a `client_secret` and there's no PKCE requirement on our end (we'll still send PKCE if the auth server enforces it, but the client itself is `confidential`).

Reference implementation to mirror: `n450s_admin/lib/auth.ts` and `n450s_admin/middleware.ts` in the n450s_website monorepo.

Concretely:
- Access + refresh tokens are stored in HttpOnly, Secure, SameSite=Lax cookies.
- A Next.js middleware (`src/middleware.ts`, added in phase 3) refreshes the access token transparently when it's about to expire.
- `aud` claim on the JWT must equal our `OAUTH_CLIENT_ID`. Verifier rejects otherwise.

## Scopes

`openid profile email`. Nothing more.

- `openid` — required, gives us `sub` (the auth identity id we link `User.authIdentityId` to in phase 5).
- `profile` — `preferred_username`, `name`, `role`.
- `email` — `email`, `email_verified`. We need this to keep matching members → users by email for billing assignments.

We deliberately do **not** request `backend:read` / `backend:write`. sub5tr4cker does not call `n450s_backend`; all data lives in our own MongoDB (advanced mode) or SQLite (local mode). Adding backend scopes would make our consent screen scarier without buying anything.

We also do **not** request `admin`. Admin in sub5tr4cker is per-group (group-creator role inside our `Group` document) and is unrelated to the n450s admin role.

## OAuth client registration

Client to register in `n450s_auth`:

| Field | Value |
|---|---|
| `clientId` | `sub5tr4cker` |
| `name` | `Sub5tr4cker` |
| `description` | Shared-subscription tracker / billing reminders |
| `clientType` | `confidential` |
| `requirePkce` | `false` (server-side; see Pattern 1) |
| `allowedScopes` | `["openid", "profile", "email"]` |
| `grantTypes` | `["authorization_code", "refresh_token"]` |
| `trusted` | `true` (first-party app, skip consent screen) |
| `accessTokenLifetime` | `3600` (1 hour, default) |
| `refreshTokenLifetime` | `604800` (7 days, default — sliding, see below) |
| `redirectUris` | see below |

### Redirect URIs

```
http://localhost:3054/api/auth/n450s/callback     # dev
https://substrack.n450s.com/api/auth/n450s/callback   # prod (placeholder — confirm domain at cutover, phase 9)
```

The route under `/api/auth/n450s/callback` is implemented in phase 2 (`phase-02-login-callback.md`). Do not collapse it into Auth.js's `/api/auth/callback/*` namespace — we want the n450s flow to be visibly distinct from any leftover Auth.js artifacts during the phase 6 deprecation.

### Registration procedure (manual, not automated by this phase)

The auth server is a separate service in a separate repo and may not be running in every environment that runs this clowalky phase. Registration is therefore **operator-driven, not part of this commit**:

1. From `/Users/nassos/Developer/n450s_website/n450s_auth/`, ensure the auth-service mongo is reachable (`AUTH_MONGODB_URI` set).
2. Either (a) write a one-off seed file modeled on `scripts/seed-frontend-client.ts` with the values from the table above and run it (`pnpm exec ts-node scripts/seed-sub5tr4cker-client.ts`), or (b) create the client through the n450s_auth admin dashboard at `/admin` → OAuth clients → new.
3. Capture the returned `clientSecret` once — it's hashed in the DB and cannot be retrieved again. Store in the deploy environment's secret store (Hetzner / Portainer env), not in the repo.
4. Set the env vars on each environment that runs sub5tr4cker advanced mode:
   - `AUTH_SERVICE_URL` (e.g. `http://localhost:3045` dev, `https://auth.n450s.com` prod)
   - `OAUTH_CLIENT_ID=sub5tr4cker`
   - `OAUTH_CLIENT_SECRET=<from step 3>`
   - `OAUTH_REDIRECT_URIS` (comma-separated; phase 1 will read this)

The actual ID/secret are recorded out-of-band (deploy secret store, password manager) — never in this repo, never in `.env.example`, never in commit messages.

## Sessions are not persistent — and this fixes it

The recurring "users get logged out" complaint is the entry motivation for this whole plan. n450s_auth's refresh-token model **resolves it directly**:

- Refresh tokens have a 7-day lifetime by default, **sliding**: every successful use resets the expiry to "now + 7 days." See `n450s-auth-integration/SKILL.md` lines 90-93.
- The middleware (phase 3) refreshes the access token automatically on every request that finds it within the expiry window. Each refresh slides the refresh-token clock forward.
- Net result: a user who interacts with the app at least once a week stays logged in **indefinitely**. Only an actual 7-day idle period forces a re-login, and even then a `prompt=none` call to Auth's IdP session (24h rolling) usually returns a fresh code silently.
- No client-side rotation logic, no rotated refresh tokens to track — n450s_auth keeps the same refresh token and just extends its expiry server-side.

This is the "persistent sessions" answer for the entire plan. Phase 3's title ("Token storage + middleware refresh (sliding sessions)") is the one that ships the fix.

## Google sign-in

**Handled by n450s_auth, not by sub5tr4cker.** n450s_auth federates Google directly at its `/login` page; when the user clicks "Continue with Google" there, n450s_auth completes the Google OAuth dance and issues *us* an `authorization_code` for our `sub5tr4cker` client. From sub5tr4cker's side, every login looks like a normal n450s_auth code exchange — Google is invisible to us.

**Implication for phase 7 (login UI rewrite):** the sub5tr4cker login page must **not** carry a Google button or any reference to `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. There is exactly one CTA — "Sign in with n450s" — which redirects to the n450s_auth `/oauth/consent` URL. Phase 6 deletes the existing Google provider from the Auth.js config; phase 7 must not reintroduce it. The `GOOGLE_*` env vars in `.env.example` will be removed in phase 6.

## Local mode

Untouched. `SUB5TR4CKER_MODE=local` continues to use `src/lib/auth/local.ts` (token cookie, auto-login as the bootstrap admin). The dual-mode `auth()` wrapper in phase 4 will branch on `SUB5TR4CKER_MODE` and return the local session unchanged when the mode is local — only the advanced-mode branch is rewritten.

This keeps the s54r CLI ("self-hosted single-user" experience) zero-config and avoids dragging an OAuth dependency into the local-mode runtime. Anyone running `s54r start` on their laptop should never see, and never need, an `AUTH_SERVICE_URL`.
