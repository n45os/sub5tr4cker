# Phase 1 — `dbcleanup` CLI script

## Goal
Single TypeScript script `scripts/db-cleanup.ts` that wraps every cleanup pass with a uniform dry-run/apply contract. Each pass is opt-in via a flag; running with no flags shows what would happen.

## Scope
- `scripts/db-cleanup.ts` runnable as `tsx scripts/db-cleanup.ts [--orphan-tasks] [--orphan-periods] [--old-notifications] [--apply]`.
- Default `--apply=false` → dry-run, write nothing.
- Each pass:
  - Connects via the existing `db()` factory — uses the StorageAdapter, never raw Mongoose. (If the adapter doesn't expose the required filter, add a `bulkArchive*` method in `src/lib/storage/adapter.ts` and implement on Mongoose only — local mode no-ops it.)
  - Prints a human-readable header (e.g. "[orphan-tasks] would cancel 47 scheduled tasks (groupId missing) — pass --apply to execute").
  - In `--apply` mode: performs the write, emits one `audit_events` row per batch with `metadata.scriptRunId` for traceability.
- A summary at the end: total docs touched per pass, elapsed time, errors.
- Add `pnpm db:cleanup` script in `package.json` that defaults to `tsx scripts/db-cleanup.ts` (i.e. dry-run no-op).

## Scope OUT
- The actual delete logic per pass — phases 2/3/4. This phase scaffolds the harness only.

## Files to touch
- `scripts/db-cleanup.ts`
- `package.json`
- `src/lib/storage/adapter.ts` (if new bulk methods are added)
- `src/lib/storage/mongoose-adapter.ts` (if new bulk methods are added)
- `src/lib/storage/sqlite-adapter.ts` (no-op stubs for the new methods)

## Acceptance criteria
- [ ] `tsx scripts/db-cleanup.ts` (no flags) prints per-pass dry-run summary, writes nothing.
- [ ] `--apply` mode requires `--<pass>` flags to actually do anything (refuses to "apply all" without explicit pass flags).
- [ ] Pass implementations are stubs printing "(stub) would do X to Y docs" — actual logic in 2/3/4.

## Manual verification
- Run locally against a seeded SQLite DB → see dry-run output.
- `pnpm lint` clean.
