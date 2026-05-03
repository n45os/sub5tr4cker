# Phase 2 — Pass 1: cancel orphan scheduled tasks

## Goal
Cancel every `scheduledtasks` row whose target no longer exists or whose underlying payment is no longer unpaid. Status flip only — no document deletion, so the cleanup is reversible.

## Scope
- Implement the `--orphan-tasks` body inside `scripts/db-cleanup.ts`:
  1. Find `scheduledtasks` where status is `pending` OR (`locked` AND `lockedAt < now - 1h`) AND one of:
     - `payload.groupId` does not match any `groups._id`
     - `payload.billingPeriodId` does not match any `billingperiods._id`
     - target payment is no longer in `pending` / `member_confirmed` (already confirmed/waived/overdue handled by worker, but the worker only acts at run time — explicit cleanup fast-tracks it)
  2. For each such task, set `status: "cancelled"`, `cancelledAt: now`, `cancellationReason: "orphan-cleanup"`.
  3. Emit one `audit_events` row per batch (not per task) for compactness: `{ action: "scheduled_tasks_orphan_cleanup", metadata: { count, scriptRunId, sampleIds: [...] } }`.
- The Mongoose adapter probably already has a `bulkCancel(filter)` method (used by the admin UI's bulk-cancel route) — reuse it. If not, add it.

## Scope OUT
- Hard-deleting the cancelled tasks — leave them for the audit trail.

## Files to touch
- `scripts/db-cleanup.ts`
- `src/lib/storage/mongoose-adapter.ts` (only if the bulk-cancel surface needs new arguments)

## Acceptance criteria
- [ ] Dry-run prints exactly the count from phase-00 inventory (modulo new tasks created since).
- [ ] `--apply` flips statuses without deleting any rows.
- [ ] Audit row written per script run.

## Manual verification
- Local mode: seed a few orphan tasks, run dry-run → see expected count, run with `--apply` → tasks status = cancelled.
- `pnpm lint` clean.
