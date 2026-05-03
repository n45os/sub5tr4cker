# Phase 0 — Reproduce + characterize the bug

## Goal
Reproduce the duplicate-billing-period bug deterministically in a test, and pin down the exact failure mode (timezone vs race vs both). The May-appears-twice symptom in production points at `createPeriodIfDue()` deriving the calendar month from local-time `Date` accessors on a non-UTC server, but we should *prove* it before changing code.

## Scope
- Read-only investigation of `src/lib/billing/periods.ts`, `src/lib/billing/calculator.ts:getPeriodDates()`, `src/jobs/check-billing-periods.ts`, and the Mongoose unique index in `src/models/billing-period.ts`.
- Add ONE failing vitest that exercises the boundary: server in UTC+2, "now" set to `2026-04-30T22:30:00.000Z` (which is `2026-05-01 00:30` local) — the test should currently produce a period whose `periodStart` is May 1 at the server-local 00:00 (i.e. April 30 22:00 UTC) instead of the canonical UTC May 1 00:00, OR it should allow a second cron tick later that day at `2026-04-30T20:00:00.000Z` (= April 30 22:00 local) to insert an "April" period — whichever path the reading of the code reveals.
- Document the exact reproduction in this brief (write findings into `phase-00-findings.md` if anything is unexpected).
- Do **not** fix anything in this phase.

## Files to touch
- `src/lib/billing/periods.test.ts` (NEW — failing test only)
- `src/lib/billing/periods.ts` (READ ONLY)
- `src/lib/billing/calculator.ts` (READ ONLY)
- `src/jobs/check-billing-periods.ts` (READ ONLY)
- `src/models/billing-period.ts` (READ ONLY)
- `.clowalky/_plans/fix-duplicate-billing-periods/phase-00-findings.md` (NEW if non-trivial findings)

## Acceptance criteria
- [ ] A new vitest exists and **fails** (red), demonstrating the duplicate-period scenario as a logical bug (i.e. two distinct DB inserts for what is conceptually the same calendar month).
- [ ] The test mocks `Date.now()` and the system timezone (or freezes `process.env.TZ` for the test process) — no real-clock dependency.
- [ ] The failure message clearly explains which boundary triggered the duplicate (UTC offset, race, or wrong constructor).

## Manual verification
- `pnpm test -- src/lib/billing/periods.test.ts` → see the new test fail with a useful diff.
- `pnpm lint` clean.
