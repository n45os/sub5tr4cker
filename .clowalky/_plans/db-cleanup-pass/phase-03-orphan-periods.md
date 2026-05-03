# Phase 3 — Pass 2: archive billing periods for soft-deleted groups

## Goal
When a group is soft-deleted (`isActive: false`), its billing periods linger and confuse queries that don't filter by group. Set `archivedAt` on every such period — no hard delete.

## Scope
- Implement the `--orphan-periods` body in `scripts/db-cleanup.ts`:
  1. Find `groups` where `isActive: false`.
  2. For each, find `billingperiods` where `group` matches AND `archivedAt` is unset.
  3. Bulk update: set `archivedAt: now`, `archivalReason: "group-soft-deleted"`.
  4. Audit event: `{ action: "billing_periods_archived_for_inactive_groups", metadata: { groupCount, periodCount, scriptRunId } }`.
- Update `src/lib/billing/collection-window.ts:collectionWindowOpenFilter()` (and any other "open periods" queries) to filter `archivedAt: null` so archived periods stop appearing in active workflows.

## Scope OUT
- Touching periods of *active* groups — out of scope (those are real data).
- Hard delete — never.

## Files to touch
- `scripts/db-cleanup.ts`
- `src/lib/billing/collection-window.ts`
- `src/lib/storage/mongoose-adapter.ts` (filter helper update)

## Acceptance criteria
- [ ] Dry-run prints expected count from phase-00 inventory.
- [ ] `--apply` sets `archivedAt` without deletion.
- [ ] Open-periods queries no longer return archived rows (verify by spot-checking one previously-deleted-group's periods before/after).

## Manual verification
- Local mode: soft-delete a test group with periods → run dry-run → see count → run `--apply` → periods have `archivedAt`.
- `pnpm test -- src/lib/billing` green (collection-window changes shouldn't break tests).
- `pnpm lint` clean.
