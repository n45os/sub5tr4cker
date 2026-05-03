# Phase 5 — Production verification

## Goal
Confirm the fix landed cleanly in production: no new duplicate periods are created on the next cron tick, and the existing duplicates have been merged.

## Scope
- After the new image has been deployed to the Hetzner VM (`substrack-app-1` rebuilt with the phase-1 + phase-2 changes):
  - SSH to the VM and run the cleanup script in `--dry-run` mode against production Mongo to confirm zero duplicates remain post-merge.
  - Wait for the next scheduled `checkBillingPeriods` cron tick (or trigger it manually via `POST /api/cron/billing` with the right secret) and re-run the dry-run script — count must still be zero.
  - Spot-check the user `nassos@duck.com` (`_id 69bac29a13693b3266bbf3aa`): both groups should show exactly one period per month for the trailing 6 months.
- Snapshot the audit log: `audit_events.find({ action: { $in: ["period_dedup_hit", "period_duplicate_merged"] } })`.
- Add a one-line entry to `CHANGELOG.md` describing the fix and the cleanup, and a link to this plan.

## Scope OUT
- Adding monitoring / alerting around `period_dedup_hit` — separate plan.

## Files to touch
- `CHANGELOG.md`
- `.clowalky/_plans/fix-duplicate-billing-periods/phase-05-verification.md` (NEW — append the actual run output for the audit trail)

## Acceptance criteria
- [ ] Dry-run cleanup against production reports zero remaining duplicates.
- [ ] Two consecutive cron ticks (or two manual triggers) produce no new duplicates.
- [ ] CHANGELOG entry added under a new dated section.
- [ ] Verification run output captured in `phase-05-verification.md`.

## Manual verification
- Documented in the phase-05-verification.md file. This is a human-driven phase; no automated tests.
