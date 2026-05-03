| ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
|----|-------|--------|------------|-------|---------|-----------|-------|
| 0 | Reproduce + characterize the bug | complete | — | phase-00-reproduce.md | 2026-05-03 | 2026-05-03 | bug confirmed: getPeriodDates uses local-time `new Date(year, month, day)`, so periodStart drifts across server TZ; reproduced via pre-seeded canonical-UTC row + cron tick at local-midnight boundary |
| 1 | Switch period date math to UTC | complete | 0 | phase-01-utc-date-math.md | 2026-05-03 | 2026-05-03 | UTC accessors in `createPeriodIfDue` + `getNextPeriodStart`; `getPeriodDates` now `Date.UTC`; `collection-window` uses `setUTCDate`/`getUTCDate`. Tests green under TZ=UTC, Europe/Athens, Pacific/Apia. Test file `periods.test.ts` had unrelated WIP touch-ups — left unstaged (not in this phase's allowlist). |
| 2 | Add a logical `(group, year, month)` dedup guard | pending | 1 | phase-02-logical-dedup-guard.md | | | |
| 3 | Add unit tests for boundary cases | pending | 1 | phase-03-tests.md | | | parallel with 2 if no file overlap |
| 4 | Backfill / cleanup script for already-duplicated periods | pending | 1 | phase-04-cleanup-script.md | | | dry-run by default |
| 5 | Production verification | pending | 2,3,4 | phase-05-prod-verify.md | | | manual; uses cleanup script in dry-run mode |
