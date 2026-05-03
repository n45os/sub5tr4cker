# Phase 4 — Pass 3: prune notification log

## Goal
The `notifications` collection grows unbounded. Prune entries older than the retention window (default 365 days) so the activity feed stays performant. Make the retention configurable via a setting key so it's not magic.

## Scope
- Add a setting `general.notificationRetentionDays` (default `365`). Read via `getSetting()` if present, fall back to env `NOTIFICATION_RETENTION_DAYS`, fall back to `365`.
- Implement the `--old-notifications` body in `scripts/db-cleanup.ts`:
  1. Compute `cutoff = now - retentionDays`.
  2. Find `notifications` where `createdAt < cutoff` AND `type !== "audit"` (preserve audit-related notifications if any).
  3. **Hard delete** these — they're append-only delivery logs, not state. Leave one summary row per `(groupId, month)` if absolute deletion would lose evidence (a small `notification_archive_stats` collection — optional, only if you care).
  4. Audit event: `{ action: "old_notifications_pruned", metadata: { count, retentionDays, scriptRunId } }`.

## Scope OUT
- Pruning audit events themselves — phase-00 says count is likely zero; revisit later.

## Files to touch
- `scripts/db-cleanup.ts`
- `src/lib/settings/service.ts` (only if the setting needs explicit registration)

## Acceptance criteria
- [ ] Dry-run reports the count (with the resolved retention window in the header).
- [ ] `--apply` deletes only rows older than cutoff.
- [ ] No active-group reminder rows are deleted (filter by `createdAt`, not by group state).

## Manual verification
- Local: seed 1 old notification + 1 fresh → dry-run shows 1 to delete → `--apply` → only the old one is gone.
- `pnpm lint` clean.
