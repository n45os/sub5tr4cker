# Phase 5a — Production dry-run cleanup (agent-runnable)

> Split out 2026-05-03 from phase 5. The autonomous agent now has SSH access to `135.181.153.99`, so the read-only dry-run portion of phase 5 can run unattended. Phase 5 keeps the operator-driven "wait for two cron ticks" + CHANGELOG entry; this phase delivers the first dry-run evidence.

## Goal

Run the existing `scripts/cleanup-duplicate-billing-periods.ts` cleanup script in `--dry-run` mode against the production `substrack` Mongo, capture the output as evidence that:

- The script's bucketing matches the inventory captured in `db-cleanup-pass/phase-00-inventory.md` (2 duplicate buckets under `group: 69bbab90f7c54c0d45117a2f`).
- No mutations are issued.
- Phase 5 has a baseline number to compare the post-deploy / post-cron tick re-run against.

## Scope

In:
- SSH to `root@135.181.153.99`.
- Run the script via the existing tooling on the running container. The repo's `pnpm cleanup:dup-periods` is the official entry point; the simplest agent path is:
  ```
  ssh root@135.181.153.99 'docker exec substrack-app-1 sh -lc "cd /app && pnpm cleanup:dup-periods 2>&1"'
  ```
  Default mode is **dry-run** (no `--apply`). If `pnpm` is unavailable in the runtime image, fall back to `node` against the compiled output.
- Capture stdout+stderr verbatim into `phase-05a-results.md`. Trim PII (member names / emails) but keep ObjectIds.
- Confirm the script reports the same 2 duplicate buckets the inventory found:
  - `(group: 69bbab90f7c54c0d45117a2f, y: 2026, m: 5) count=2`
  - `(group: 69bbab90f7c54c0d45117a2f, y: 2026, m: 4) count=2`

Out:
- Running with `--apply`. That is the operator's call (and they may decide to run it from phase 5 once the new image is deployed).
- Triggering the cron tick. Phase 5 owns that.
- Modifying the script. Phase 4 owns that.

## Important caveat

The substrack-app-1 image at probe time was `ghcr.io/n45os/sub5tr4cker:latest` Up 4 weeks — i.e., it predates phase 1+2's UTC fix and predates phase 4's cleanup script. Two consequences:

1. The container may not have `scripts/cleanup-duplicate-billing-periods.ts` at all. If `pnpm cleanup:dup-periods` errors with "no such command", set `Status = blocked` and add a `Notes:` reason — the operator must redeploy the image first.
2. The container's view of "duplicate periods" reflects production data that hasn't been protected by the new dedup guard yet. So the dry-run output is a **pre-fix snapshot** — it tells us how many duplicates exist *today*, before the deploy. That's still useful evidence; document it as such.

## Files to touch

- `.clowalky/_plans/fix-duplicate-billing-periods/phase-05a-results.md` (new — dry-run output, redacted)
- `.clowalky/_plans/fix-duplicate-billing-periods/STATUS.md` (auto)

## Acceptance criteria

- [ ] `phase-05a-results.md` contains the full dry-run output (script stdout/stderr).
- [ ] The output explicitly says "dry-run" (or equivalent — the script default).
- [ ] No `period_duplicate_merged` audit event was actually emitted (verify by counting them in Mongo before and after — the count should be identical).

## Manual verification

```bash
# Pre-count
ssh root@135.181.153.99 'docker exec substrack-mongo-1 mongosh substrack --quiet --eval "
print(\"before:\", db.audit_events.countDocuments({action: \"period_duplicate_merged\"}));
"'

# Dry-run
ssh root@135.181.153.99 'docker exec substrack-app-1 sh -lc "cd /app && pnpm cleanup:dup-periods 2>&1"'

# Post-count (must equal before)
ssh root@135.181.153.99 'docker exec substrack-mongo-1 mongosh substrack --quiet --eval "
print(\"after:\", db.audit_events.countDocuments({action: \"period_duplicate_merged\"}));
"'
```

## Hard rules

- Never pass `--apply`. The brief default is dry-run; do not override.
- Never edit the script file. Phase 4 owns it.
- If the script is missing in the running container, **block** instead of trying alternatives.
- Stage exactly the new results file + STATUS.md. Never `git add -A`.
- Commit subject: `CLWLK: fix-duplicate-billing-periods/5a — prod dry-run snapshot`.
