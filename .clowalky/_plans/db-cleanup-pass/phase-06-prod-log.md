# Phase 6 — Production execution log + retro

## Goal
Run every prior pass against production in dry-run, then apply, then capture the full transcript and the row-count deltas as evidence.

## Scope
- For each pass (orphan-tasks, orphan-periods, old-notifications, maintenance):
  1. SSH to the Hetzner VM.
  2. Run the script in dry-run, copy the output into `phase-06-prod-log.md`.
  3. Run with `--apply`, copy the output too.
  4. Re-run dry-run to confirm zero remaining items.
- After all passes: collect aggregate metrics (DB size before/after, collection counts before/after).
- Update `CHANGELOG.md` with a one-line entry per pass.
- Spot-check the user `nassos@duck.com` afterwards: their two groups still exist, billing periods still intact, scheduled tasks unaffected (no false-positive cancels).

## Scope OUT
- Anything that involves dropping data outside the script's scope.

## Files to touch
- `.clowalky/_plans/db-cleanup-pass/phase-06-prod-log.md`
- `CHANGELOG.md`

## Acceptance criteria
- [ ] Transcript captured for every pass (dry-run + apply + verify).
- [ ] DB size delta recorded.
- [ ] User-data sanity check passed (groups + recent periods unaffected).
- [ ] CHANGELOG entries added.

## Manual verification
- Read the prod-log file cold — every step is documented and reproducible.
