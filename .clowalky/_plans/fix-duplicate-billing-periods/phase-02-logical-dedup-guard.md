# Phase 2 — Add a logical `(group, year, month)` dedup guard

## Goal
Belt-and-braces dedup. Even with the UTC fix in place, the existing `(group, periodStart)` UNIQUE index only protects against *byte-identical* `periodStart` values. Any future call site that happens to compute `periodStart` slightly differently (e.g. someone manually creates a period at noon instead of midnight) would still slip past. Add a logical guard at the application layer that compares (groupId, UTC year, UTC month) and refuses to create a second period for the same calendar month.

## Scope
- In `src/lib/billing/periods.ts`, before inserting via the storage adapter, query existing periods for this group whose `periodStart`'s UTC year+month equals the candidate's. If one exists, return the existing period (idempotent) and log a `period_dedup_hit` audit event so we can spot any callers still racing.
- Mirror the same guard in the manual-create path: `POST /api/groups/[groupId]/billing` (`route.ts`) — currently uses `getBillingPeriodByStart`, switch to the new helper that compares year+month rather than exact `periodStart`.
- Extract the helper as `findExistingPeriodForMonth(store, groupId, year, monthIndex)` in `src/lib/billing/periods.ts` so both call sites use the same logic.

## Scope OUT
- DB index changes — leave the `(group, periodStart)` UNIQUE index in place; it's still useful as a last-line defense.
- Cleanup of duplicates already in production — phase 4.

## Files to touch
- `src/lib/billing/periods.ts`
- `src/app/api/groups/[groupId]/billing/route.ts`
- `src/models/audit-event.ts` (only if a new audit event constant is needed)

## Acceptance criteria
- [ ] `findExistingPeriodForMonth()` exists and is the single source of truth for "is there already a period for this month".
- [ ] `createPeriodIfDue()` and the manual-create POST both use it.
- [ ] An audit event `period_dedup_hit` is emitted when the guard fires.
- [ ] Existing `getBillingPeriodByStart()` callers that don't care about month-level dedup are left alone (e.g. payment lookup by exact start).

## Manual verification
- `pnpm test -- src/lib/billing` green.
- Call `POST /api/groups/[groupId]/billing` twice in a row for the same `periodStart` (different times of day) — second call returns the existing period, not a 409.
- Check audit log shows one `period_dedup_hit` per duplicate attempt.
