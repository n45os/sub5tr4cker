# Phase 4 — Cleanup script for already-duplicated periods

## Goal
Find every existing duplicate-period pair in production (groups whose `billingperiods` collection has two rows for the same logical UTC year+month) and merge them: keep the older row's `_id`, port the *more advanced* payment statuses onto it, archive (do not hard-delete) the redundant row.

## Scope
- New script `scripts/cleanup-duplicate-billing-periods.ts` runnable as `tsx scripts/cleanup-duplicate-billing-periods.ts [--apply]`.
- Default mode: `--dry-run` (no writes). Print a table: groupId, year-month, kept periodId (oldest by `createdAt`), discarded periodId, payment-status diff that would be merged.
- `--apply` mode: for each duplicate pair:
  - Pick the **older** period as canonical.
  - Walk both periods' `payments[]`. For each `memberId`: keep the **most advanced** status (priority order `confirmed > member_confirmed > pending > overdue` — verify against `BillingPeriod` model).
  - Move any `memberConfirmedAt` / `adminConfirmedAt` timestamps onto the canonical row.
  - Archive the discarded period: don't delete; rename collection field `archivedAt = new Date()` and leave it in `billingperiods` so we have an audit trail.
- Emit one `audit_events` row per merge: `{ action: "period_duplicate_merged", metadata: { keptId, discardedId, mergedPayments: [...] } }`.
- Print a summary at the end: groups touched, periods archived, payments merged, errors.

## Scope OUT
- Deleting the archived rows — leave them. A separate decision later.
- Touching scheduled tasks — those self-skip via worker-time checks.

## Files to touch
- `scripts/cleanup-duplicate-billing-periods.ts`
- `package.json` (add `pnpm cleanup:dup-periods` script that runs the dry-run; users can pass `--apply` themselves)

## Acceptance criteria
- [ ] Dry-run mode prints a clean report and writes nothing.
- [ ] `--apply` mode is idempotent (running it twice is a no-op).
- [ ] Each merge is reversible: archived period rows still exist with their original `_id` and an `archivedAt`.
- [ ] An audit event is written per merge.

## Manual verification
- Local mode: seed two duplicate periods on a test group, run the script in dry-run → see one row in the report. Run with `--apply` → see one period archived, payments merged, audit event written.
- `pnpm test` green (script may have its own test, optional).
