# Phase 9 — Production cutover + rollback plan

## Goal
Switch production from the legacy NextAuth flow to n450s_auth without locking anyone out, with a clearly documented rollback path.

## Scope
- Pre-cutover (in this order):
  1. Register the production OAuth client in n450s_auth (or finalise the one created in phase 0). Capture client ID + secret in the production secret store (NOT in the repo).
  2. Run the user-linking migration script (phase 5) against production Mongo in dry-run, then with `--apply`. Surface unmatched users; manually invite them via n450s if needed.
  3. Deploy the new sub5tr4cker image to a staging URL and walk through the smoke checklist there.
- Cutover:
  1. Set the production env vars (`AUTH_SERVICE_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_REDIRECT_URIS`, …).
  2. Deploy. Restart `substrack-app-1`.
  3. Invalidate stale NextAuth session cookies (or just let them naturally fail over to the n450s redirect).
  4. Visit `/login` from a fresh browser → verify the n450s flow works end-to-end.
- Rollback (if needed):
  1. Re-deploy the previous image (the one before phase 6 deletion).
  2. Restore the legacy env vars (`NEXTAUTH_URL`, etc.).
  3. Existing user passwords still work because the `hashedPassword` field is preserved in the User schema (we did not drop it in phase 6 — verify).
- Document everything in `.clowalky/_plans/migrate-auth-to-n450s/phase-09-cutover-log.md`.

## Scope OUT
- Removing the `hashedPassword` field — keep it for at least one release as a rollback safety net. Drop in a separate plan after a stable period.

## Files to touch
- `.clowalky/_plans/migrate-auth-to-n450s/phase-09-cutover-log.md`
- `CHANGELOG.md`
- `_context/context.md` (update auth section)

## Acceptance criteria
- [ ] Production users can log in via n450s.
- [ ] No stuck-in-loop redirects.
- [ ] Cutover log captured.
- [ ] Rollback procedure documented and known to work (validated on staging).

## Manual verification
- Cutover walk completed; users log in successfully.
- Rollback documented with exact commands.
