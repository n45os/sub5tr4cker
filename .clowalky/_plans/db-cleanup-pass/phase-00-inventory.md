# Phase 0 — Inventory cleanup candidates

## Goal
Enumerate every category of cruft in the production `substrack` Mongo so later phases have concrete numbers to target. Read-only — nothing is modified.

## Scope
- SSH into the Hetzner VM and run `mongosh substrack` queries via `docker exec substrack-mongo-1`. Capture counts (and a few sample docs) for:
  - **Orphan scheduled tasks**: `scheduledtasks` whose `groupId` does not appear in `groups`, OR whose `payload.billingPeriodId` does not appear in `billingperiods`. Status pending or locked only.
  - **Orphan billing periods**: `billingperiods` whose `group` references a `groups` row with `isActive: false` (soft-deleted) and where `archivedAt` is unset.
  - **Duplicate billing periods** (also covered by `fix-duplicate-billing-periods` plan; cross-link the count here so the cleanup pass doesn't double-handle).
  - **Old notifications**: `notifications` older than 365 days.
  - **Stale lock holders**: `scheduledtasks.locked` rows whose `lockedAt < now - 1h` (the worker handles 5-min stale locks; anything older indicates a hung run).
  - **Audit events older than 730 days** (sanity — likely none yet, but worth a count).
- Write findings to `.clowalky/_plans/db-cleanup-pass/phase-00-inventory.md` (overwrite this brief is fine — record raw counts, top 10 example docs per category, redact PII).
- Do NOT write to the DB.

## Files to touch
- `.clowalky/_plans/db-cleanup-pass/phase-00-inventory.md` (overwrite with results in-place)

## Acceptance criteria
- [ ] Each category has a current count (or "0").
- [ ] At least one sample document per non-empty category is captured (with email/PII redacted).
- [ ] No mutation queries were run.

## Manual verification
- `git diff` shows changes only to the inventory file.
- The next phase can read this file and write the cleanup script with concrete bounds.
