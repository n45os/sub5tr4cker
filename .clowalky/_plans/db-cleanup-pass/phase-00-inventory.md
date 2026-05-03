# Phase 0 — Inventory cleanup candidates

> Captured 2026-05-03 19:36 UTC via `docker exec substrack-mongo-1 mongosh substrack` (read-only — no `--apply`, no writes). All identifiers below are real ObjectIds.
>
> Per the original brief: this file was a brief that asked the agent to overwrite itself with results. That has now happened — the goal/scope/criteria below describe what was done; the **Counts** and **Findings** sections are the actual inventory.

## Goal (originally)

Enumerate every category of cruft in the production `substrack` Mongo so later phases have concrete numbers to target. Read-only — nothing is modified.

## Counts

| Category | Count | Action proposed (later phases) |
|---|---:|---|
| Orphan scheduledtasks (groupId not in groups, status pending\|locked) | **0** | none |
| Orphan billingperiods (group.isActive=false, archivedAt unset) | **6** | archive (phase 1 owns) |
| Duplicate billingperiods by (group, year, month) | **2 buckets** | defer to `fix-duplicate-billing-periods/4` cleanup script |
| Old notifications (createdAt > 365 days) | **0** | none |
| Stale lock holders (status=locked, lockedAt < now-1h) | **0** | none |
| Audit events older than 730 days (both `audit_events` and `auditevents`) | **0** | none |

## Findings

### Orphan billingperiods (all 6 under group `69bac59addf7b647fbfdbde4`, which is `isActive=false`)

```
{ _id: 69bc0139839567b1739c9137, group: 69bac59addf7b647fbfdbde4, periodStart: 2026-04-01T00:00:00.000Z }
{ _id: 69bc013e839567b1739c9160, group: 69bac59addf7b647fbfdbde4, periodStart: 2026-05-01T00:00:00.000Z }
{ _id: 69bc013e839567b1739c9167, group: 69bac59addf7b647fbfdbde4, periodStart: 2026-06-01T00:00:00.000Z }
{ _id: 69bc321f64554dfe2907a928, group: 69bac59addf7b647fbfdbde4, periodStart: 2026-03-01T00:00:00.000Z }
{ _id: 69bc322064554dfe2907a92f, group: 69bac59addf7b647fbfdbde4, periodStart: 2026-02-01T00:00:00.000Z }
... (6 total)
```

**Action**: phase 1 sets `archivedAt = new Date()` on all 6. Use the raw-collection-driver path that `fix-duplicate-billing-periods/4`'s `scripts/cleanup-duplicate-billing-periods.ts` uses so the schema's pre-validate hooks don't run on the archive flip. Idempotent — skip rows where `archivedAt: { $exists: true }`.

### Duplicate billingperiods (defer to a different plan)

```
{ key: { group: 69bbab90f7c54c0d45117a2f, y: 2026, m: 5 }, count: 2 }
{ key: { group: 69bbab90f7c54c0d45117a2f, y: 2026, m: 4 }, count: 2 }
```

Both buckets non-archived. **Do NOT double-handle here** — the existing `fix-duplicate-billing-periods/4` cleanup script merges by `(group, UTC year+month)`, keeps the oldest by `createdAt`, and archives the rest. Phase 5 of that plan will run dry-run + apply against prod. This `db-cleanup-pass` plan explicitly defers the duplicate cleanup to that plan.

### Notifications, stale locks, audit events — zero

- `notifications` older than 365 days → 0. Either app-side cleanup is working or the data hasn't accumulated long enough yet.
- `scheduledtasks.locked` with `lockedAt < now-1h` → 0. The existing 5-min-stale-lock-recovery worker is keeping up.
- `audit_events` / `auditevents` older than 730 days → 0. The project itself isn't 2 years old yet.

These categories are not worth a cleanup phase right now. Re-check at the next yearly review.

## What phase 1 should target

Exactly **one** mutation category:

- **Archive 6 orphan billingperiods** under `group: 69bac59addf7b647fbfdbde4` (group `isActive=false`). Set `archivedAt = new Date()`. Idempotent (skip rows where `archivedAt` is already set). Audit each archive with a `period_orphan_archived` event.

Everything else is either zero (no-op) or covered by another plan. The phase 1 brief should be tightened to reflect this — phases 2/3 of the original "design + apply + verify" arc may collapse into a single phase.

## Re-runnable verification command

```bash
ssh root@135.181.153.99 'docker exec substrack-mongo-1 mongosh substrack --quiet --eval "
print(\"orphan billingperiods left (group.isActive=false, archivedAt null): \" + db.billingperiods.find({archivedAt: null}).toArray().filter(b => {
  var g = db.groups.findOne({_id: b.group}); return g && !g.isActive;
}).length);
"'
# expected (post phase 1 apply): 0
```

## No-mutations guarantee

This phase ran read-only `find`, `aggregate`, `countDocuments` queries. No `update`, `insert`, `delete`, or `bulkWrite` was issued. `git diff` shows changes only to this brief.
