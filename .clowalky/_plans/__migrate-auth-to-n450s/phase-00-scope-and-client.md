# Phase 0 — Decide auth scope + register OAuth client

## Goal
Pin down what "use n450s_auth" actually means for sub5tr4cker, and register the OAuth client so later phases have concrete IDs/secrets. Local mode stays out of scope (it stays on token-cookie auto-login — that's the whole point of local mode).

## Scope
- Write `.clowalky/_plans/migrate-auth-to-n450s/decisions.md` capturing:
  - Confidential client (Pattern 1 in n450s integration guide) — sub5tr4cker is server-rendered Next.js, NOT a SPA.
  - Scopes: `openid profile email` (no n450s_backend scopes — this app doesn't talk to backend).
  - Redirect URIs: `https://substrack.<domain>/api/auth/n450s/callback` (prod), `http://localhost:3054/api/auth/n450s/callback` (dev).
  - Sliding refresh token = the answer to "sessions are not persistent" — n450s_auth refresh tokens extend on every use; with our middleware doing transparent refresh, the user stays logged in indefinitely while active.
  - Google sign-in: handled *by n450s_auth*, not sub5tr4cker. We don't need a Google provider on our side — n450s_auth already federates. Document this so phase 7 doesn't accidentally re-add a Google button on our login form.
  - Local mode: untouched. `SUB5TR4CKER_MODE=local` continues to use the existing token cookie path.
- Register the client in n450s_auth (run the appropriate seed script under `/Users/nassos/Developer/n450s_website/n450s_auth/scripts/` or use the admin API). Capture `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`. Mark them as required env vars in `.env.example` (do not commit secrets).
- Add `AUTH_SERVICE_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_REDIRECT_URIS` to `.env.example`.

## Scope OUT
- Any code under `src/lib/auth/` — phases 1+.
- Local mode changes — explicitly off-limits across this entire plan.

## Files to touch
- `.clowalky/_plans/migrate-auth-to-n450s/decisions.md`
- `.env.example`

## Acceptance criteria
- [ ] `decisions.md` exists and answers the five bullets above.
- [ ] Client is registered in n450s_auth (record the resulting IDs in the decisions doc, not in the repo).
- [ ] `.env.example` lists the new env vars.

## Manual verification
- Read `decisions.md` → can implement phase 1 from it without further questions.
