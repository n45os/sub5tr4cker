# Phase 9 — Production cutover + rollback log

> Status: **procedure documented; production cutover not yet executed.** This phase ships the runbook, not the cutover itself. The operator who flips the switch records timestamps + outcomes in the "Run log" section at the bottom and (if anything goes wrong) in the rollback section.

## Pre-flight blockers — fix before cutover

Surfacing carryovers from earlier phases that **will break the smoke walk** if cutover happens as-is. These are outside this brief's "Files to touch" allowlist, so this phase only documents them; they must be closed in a separate follow-up before any cutover.

1. **Callback does not persist cookies.** `src/app/api/auth/n450s/callback/route.ts` still has the phase-2 `setSessionTokens` no-op stub. Without it, the n450s flow completes but no `s5_at`/`s5_rt` cookies are written, so the next request to `/dashboard` will redirect back to `/login` — infinite loop. Fix: call the real `setSessionTokens` helper from `src/lib/auth/n450s/session-cookies.ts` with the token-exchange response. Verify against unit-test scenarios already covered in `session-cookies.test.ts`.
2. **`invite-callback` imports `next-auth/react`.** `src/app/(auth)/invite-callback/page.tsx` still calls `signIn` from `next-auth/react`, which was deleted in phase 6. Any user opening an old invite link in production will hit a 500. Fix: replace with a redirect to the n450s login URL carrying `callbackUrl` set to the invite-acceptance route.
3. **Local-mode logout is a no-op.** `/api/auth/n450s/logout` throws when n450s env vars are unset. Local mode (`SUB5TR4CKER_MODE=local`) is out of scope for this plan, so this is acceptable for the s54r CLI users — but if any production-mode deploy ever sits without `AUTH_SERVICE_URL` (e.g. half-rolled config), sign-out also breaks. Mitigation: confirm all production env vars are present before flipping traffic.

Do not start the cutover until items 1 and 2 are fixed and a fresh image is built. Item 3 is environmental, addressed below.

## Pre-cutover checklist

Run these in order. Each step has a clear pass condition. Stop and re-plan if any step fails.

### 1. OAuth client registration

**Goal:** confirm a `sub5tr4cker` OAuth client exists in production n450s_auth with the right redirect URI and capture its secret.

- [ ] On the production auth server (`n450s_website/n450s_auth/`), open the admin dashboard at `<auth-url>/admin` → OAuth clients. Confirm the `sub5tr4cker` client exists with values from `decisions.md` (clientId `sub5tr4cker`, confidential, scopes `openid profile email`, grants `authorization_code` + `refresh_token`, `trusted: true`).
- [ ] Confirm `redirectUris` includes the production callback: `https://<sub5tr4cker-prod-host>/api/auth/n450s/callback`. The host is whatever the production deployment serves on. Update the entry in `decisions.md` "Redirect URIs" if the host differs from the placeholder there.
- [ ] If the client does not exist, create it (admin UI or seed script per `decisions.md` step 2). Capture the returned `clientSecret` once — the DB stores a hash, the plain value cannot be recovered later.
- [ ] Store `clientSecret` in the production secret store (Hetzner / Portainer env). **Never** in this repo, in commit messages, in `.env.example`, or in this log.

**Pass condition:** client visible in admin UI, secret captured in deploy secret store, redirect URI matches the planned production host.

### 2. User-linking migration (dry-run, then apply)

**Goal:** every existing production User has `authIdentityId` set or is on a known unmatched-list. Phase 5 shipped `scripts/link-existing-users-to-n450s.ts` which calls `/admin/api/users-sync` on the auth service.

- [ ] Confirm `N450S_ADMIN_TOKEN` is available in the migration runner's environment (one-shot use; rotate after).
- [ ] Dry-run against production Mongo:
      `pnpm tsx scripts/link-existing-users-to-n450s.ts --uri "$PROD_MONGO_URI" --auth-url "$AUTH_SERVICE_URL"`
      (no `--apply` flag = dry-run).
- [ ] Inspect the output. Note unmatched users — the ones with no matching n450s identity by email. These users will not be able to log in until their email is registered with n450s_auth (manual signup at `<auth-url>/signup`, or admin invite).
- [ ] Decide per unmatched user: invite via n450s, or accept that they re-register on first login attempt. Record the decision in the run log.
- [ ] Apply:
      `pnpm tsx scripts/link-existing-users-to-n450s.ts --uri "$PROD_MONGO_URI" --auth-url "$AUTH_SERVICE_URL" --apply`
      The script is idempotent — re-running with `--apply` after a partial run is safe.

**Pass condition:** dry-run report reviewed, unmatched-users list captured in run log, `--apply` finished without errors, a re-run with `--apply` reports zero new links.

### 3. Staging deploy + smoke walk

**Goal:** every smoke scenario from phase 8's checklist passes against a deploy that mirrors production, before any production traffic moves.

- [ ] Deploy the new image (with pre-flight blockers 1 + 2 fixed) to a staging URL. Staging must point at a separate Mongo (or a snapshot of prod) and the **production** n450s_auth (or a staging n450s_auth that the same OAuth client knows about — confirm `redirectUris` includes the staging host).
- [ ] Set staging env vars: `AUTH_SERVICE_URL`, `OAUTH_CLIENT_ID=sub5tr4cker`, `OAUTH_CLIENT_SECRET=<from step 1>`, `OAUTH_REDIRECT_URIS=https://<staging>/api/auth/n450s/callback`, plus existing production-style vars (`MONGODB_URI`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, etc).
- [ ] Walk the six smoke scenarios from `phase-08-results.md`:
  1. First-time login via n450s creates a User.
  2. Existing User logs in and lands on their groups.
  3. Access token expires → silent refresh → no redirect.
  4. Refresh token revoked → next request redirects to login.
  5. Sign-out clears cookies and redirects to n450s `/oauth/logout`.
  6. Local-mode untouched (`SUB5TR4CKER_MODE=local pnpm dev`; the s54r CLI is the operator-facing surface here, but a quick `SUB5TR4CKER_MODE=local pnpm dev` smoke is faster).
- [ ] Record results in the run log table below.

**Pass condition:** all six scenarios pass on staging. Item 6 is acceptable as "sign-out is a known no-op in local mode" per phase-7 carryover.

## Cutover

In this order, on the production VM. Each step is logged with a UTC timestamp.

1. [ ] **Confirm pre-flight steps are all green.** If any pre-flight blocker is not fixed or any staging smoke item failed, abort.
2. [ ] **Set production env vars.** In Portainer (or Hetzner secret manager), set/update on the `substrack-app-1` container:
   - `AUTH_SERVICE_URL=https://<auth-prod-host>`
   - `OAUTH_CLIENT_ID=sub5tr4cker`
   - `OAUTH_CLIENT_SECRET=<from pre-flight step 1>`
   - `OAUTH_REDIRECT_URIS=https://<sub5tr4cker-prod-host>/api/auth/n450s/callback`
   - Leave `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in place for now — they are unused after phase 6 but kept until the post-cutover cleanup so a same-image rollback works without env changes.
3. [ ] **Deploy the new image.** Pull the tagged image, restart `substrack-app-1`. Tag the image so the rollback step has a concrete name to refer to.
4. [ ] **Tail container logs while the first request lands.** Verify `[n450s]` log lines for `verifyAccessToken` and `refreshTokens`; no `next-auth` lines should appear.
5. [ ] **Walk through the prod login flow from a fresh browser.**
   - Visit `https://<sub5tr4cker-prod-host>/` → expect 307 to `/login`.
   - `/login` shows a single "Continue with n450s" CTA.
   - Click → 307 to `<auth-prod-host>/oauth/consent?...`.
   - Complete the n450s flow → 307 back to `/api/auth/n450s/callback?code=...&state=...`.
   - Callback writes `s5_at` + `s5_rt` cookies, 307 to `/dashboard`.
   - `/dashboard` renders without further redirect.
6. [ ] **Smoke a second user.** Pick someone whose row was linked by step 2 of pre-flight, ideally not yourself, and have them log in. Confirm they land on their groups (not someone else's).
7. [ ] **Stale NextAuth cookies.** Existing prod sessions still have `next-auth.session-token` cookies. Phase-6 deleted the route that issues them; the new middleware ignores them. They naturally fail-over on the next request to a protected route — first request gets a redirect to `/login`, then the n450s flow takes over. No active invalidation needed.

**Pass condition:** primary author + at least one other user log in via n450s end-to-end, dashboard renders, no error logs.

## Rollback

The rollback path is the **previous image tag with the previous env vars**. Both must be ready in advance — do not start a cutover without an image tag to revert to.

### Trigger conditions

Roll back if any of:
- Login flow fails for ≥ 1 user and the cause is not "this user was never registered with n450s_auth" (a known unmatched-user item from pre-flight step 2).
- An infinite-redirect loop appears (likely indicates the callback cookie write or middleware refresh is broken).
- Refresh-token loop fails (users get logged out within minutes of logging in).
- Any error log mentions `Cannot read properties of undefined (reading 'sub')` or similar — the session resolver is the most likely culprit on a botched build.

### Rollback procedure

1. [ ] **Re-deploy the previous image.** Tag noted at cutover step 3. Restart `substrack-app-1` against that tag.
2. [ ] **Restore the legacy env vars.** They were never removed during cutover — the `NEXTAUTH_URL` / `NEXTAUTH_SECRET` / `GOOGLE_*` env vars are still in place from before phase 6 deploy. The rollback image (= pre-phase-6 image) reads them and restarts NextAuth normally.
3. [ ] **Confirm the legacy login route exists in the rolled-back image.** Pre-phase-6 image has `/api/auth/[...nextauth]`. Visit `<host>/api/auth/signin` → expect the NextAuth provider chooser.
4. [ ] **Verify legacy login works.** A user with a `hashedPassword` in Mongo can still log in via Credentials. **`hashedPassword` was deliberately left in the User schema in phase 6** for exactly this scenario — confirm by inspecting one User document; the field should be present.
5. [ ] **Notify users** that login may have been disrupted and they should retry; do not announce the rollback unless asked.
6. [ ] **Capture the failure** in the run log below: what failed, timestamps, what the rollback restored. The investigation continues out-of-band.

### What rollback does NOT recover

- `User.authIdentityId` values written by pre-flight step 2 stay on the documents. They are inert when NextAuth is re-enabled (nothing reads them) — safe to leave; do not write a script to clear them. They become useful again on the next attempt.
- Any in-flight n450s sessions: users who logged in via n450s during the brief cutover window have `s5_at`/`s5_rt` cookies. The legacy image ignores them and falls through to NextAuth → first request after rollback redirects them to the legacy login. Acceptable.

## Post-cutover (after a stable period)

Out of scope for this phase, but flagged here so the next operator picks them up:

- Drop `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` from the production env (and from `.env.example` if any reference snuck back in).
- Drop `User.hashedPassword` and the `change-password` route in a separate plan, after at least one release with the new auth where rollback is no longer realistic.
- Remove `bcryptjs` once `change-password` is gone.

## Run log

Operator fills the rest of this section during cutover. Use UTC timestamps.

| Step | Timestamp (UTC) | Outcome | Notes |
|------|-----------------|---------|-------|
| Pre-flight 1 (OAuth client) |  |  |  |
| Pre-flight 2 (linking dry-run) |  |  |  |
| Pre-flight 2 (linking apply) |  |  |  |
| Pre-flight 3 (staging smoke) |  |  |  |
| Cutover 2 (env vars) |  |  |  |
| Cutover 3 (deploy) |  |  |  |
| Cutover 5 (login walk) |  |  |  |
| Cutover 6 (second user) |  |  |  |

### Unmatched users from pre-flight step 2

_(operator records emails / decisions here)_

### Rollback (if executed)

_(operator records timestamps + cause here, or leaves empty if cutover was clean)_
