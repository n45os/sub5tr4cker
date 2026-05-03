# Phase 5 — Rebuild stale indexes + compact

## Goal
After bulk archives + prunes, Mongo has fragmented data files and possibly stale index entries. Run an online maintenance pass: verify all expected indexes exist, drop any that aren't in the codebase, and `compact` per collection during a low-traffic window.

## Scope
- Build a tiny script `scripts/db-maintenance.ts` (or extend `db-cleanup.ts`):
  - Reads the expected index list from each Mongoose model file (`src/models/*.ts`) — there's no central registry, so hand-curate the list in the script header.
  - For each collection: list current indexes via `db.<coll>.getIndexes()`, compare to expected. Drop unexpected, create missing.
  - Run `db.runCommand({ compact: '<coll>' })` per collection (off-hours; will pause writes briefly). Report bytes reclaimed.
- The script is `--dry-run` by default; `--apply` actually does the work.

## Scope OUT
- Schema changes — none. This is purely housekeeping.

## Files to touch
- `scripts/db-maintenance.ts`
- `package.json` (`pnpm db:maintenance` script)

## Acceptance criteria
- [ ] Dry-run prints index diff per collection + estimated bytes to reclaim per collection.
- [ ] `--apply` reports actual bytes reclaimed.
- [ ] No data loss; row counts unchanged before/after.

## Manual verification
- Run against a local MongoDB (use `docker run --rm -p 27017:27017 mongo:7` if needed) → diff matches code.
- `pnpm lint` clean.
