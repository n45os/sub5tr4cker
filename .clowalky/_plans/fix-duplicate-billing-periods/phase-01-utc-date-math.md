# Phase 1 — Switch period date math to UTC

## Goal
Make billing-period date derivation timezone-independent. All "current month/year" reads must use `getUTCFullYear()` / `getUTCMonth()`, and all `periodStart` / `periodEnd` constructions must use `Date.UTC(...)`. The phase-0 test should turn green.

## Scope
- Replace local-time `.getFullYear()` / `.getMonth()` calls in `createPeriodIfDue()` with `getUTCFullYear()` / `getUTCMonth()`.
- Update `getPeriodDates()` in `src/lib/billing/calculator.ts` to construct period boundaries via `new Date(Date.UTC(year, month, day))` (and the period-end equivalent), so a given `(year, month, cycleDay)` always yields the **same** `Date` object regardless of server timezone.
- Audit the rest of `src/lib/billing/` for sibling local-time usage (e.g. `collection-window.ts` `getCollectionOpensAt`) and switch to UTC arithmetic.
- Do NOT introduce a date library — Node `Date` is sufficient with explicit UTC accessors.

## Scope OUT
- The unique-index / dedup guard work — handled in phase 2.
- Cleanup of historical duplicates — handled in phase 4.

## Files to touch
- `src/lib/billing/periods.ts`
- `src/lib/billing/calculator.ts`
- `src/lib/billing/collection-window.ts`

## Acceptance criteria
- [ ] All reads of "current year/month" inside `src/lib/billing/` use UTC accessors.
- [ ] `getPeriodDates(year, month, cycleDay)` is pure: same inputs always produce the same `Date` object across `process.env.TZ` settings.
- [ ] Phase-0 vitest now passes.
- [ ] `pnpm test -- src/lib/billing` is green for the existing tests.

## Manual verification
- `pnpm test -- src/lib/billing` → green.
- `TZ=UTC pnpm test -- src/lib/billing` → green.
- `TZ=Asia/Athens pnpm test -- src/lib/billing` → green.
- `TZ=Pacific/Apia pnpm test -- src/lib/billing` → green (extreme offset).
- `pnpm lint` clean.
