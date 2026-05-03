# Phase 3 — Unit tests for boundary cases

## Goal
Lock the regression in. Cover every boundary that has historically caused or could cause duplicate-period creation: month-end at midnight UTC, daylight-savings transitions in non-UTC test timezones, leap-day cycle days, cycle days higher than the month length (e.g. `cycleDay = 31` in February).

## Scope
- Expand `src/lib/billing/periods.test.ts` (new in phase 0) with parametric cases:
  - cron tick at `YYYY-MM-DDT23:30:00Z` for a server in `Pacific/Apia`, `Asia/Athens`, `America/Los_Angeles`, and `UTC` — must produce exactly one period for the resulting UTC month.
  - cycleDay = 31 in a 30-day month — period clamps to the last day of the month, not "spillover into next month".
  - leap year Feb 29 cycleDay handled.
  - calling `createPeriodIfDue()` twice in the same process tick is a no-op (returns the same `_id`).
- Add a vitest for the manual POST route to confirm the dedup path: two POSTs for the same month with slightly different `periodStart` times → second returns the same period, audit event emitted.

## Scope OUT
- E2E tests through the cron HTTP route — covered by phase 5 (prod verify).

## Files to touch
- `src/lib/billing/periods.test.ts`
- `src/app/api/groups/[groupId]/billing/route.test.ts` (new or extend existing)

## Acceptance criteria
- [ ] All new tests pass under `TZ=UTC`, `TZ=Asia/Athens`, `TZ=Pacific/Apia`.
- [ ] Coverage for `getPeriodDates()` and `createPeriodIfDue()` is at or above 90 % branch coverage (not a hard rule — judgment call).
- [ ] No flake risk — every test mocks `Date.now()` explicitly.

## Manual verification
- `pnpm test -- src/lib/billing` green.
- `TZ=Pacific/Apia pnpm test -- src/lib/billing` green.
- `pnpm lint` clean.
