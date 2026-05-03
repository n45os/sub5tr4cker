| ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
|----|-------|--------|------------|-------|---------|-----------|-------|
| 0 | Inventory: enumerate cleanup candidates from prod DB | blocked | — | phase-00-inventory.md | 2026-05-03 | | needs explicit user OK to SSH `hetzner` and run read-only `mongosh substrack` via `docker exec substrack-mongo-1` |
| 1 | Build a `dbcleanup` CLI script with dry-run as default | pending | 0 | phase-01-cleanup-script.md | | | local-runnable, prod-safe |
| 2 | Pass 1: cancel scheduled tasks pointing at deleted groups/periods | pending | 1 | phase-02-orphan-tasks.md | | | reversible (status flip only) |
| 3 | Pass 2: archive billing periods for soft-deleted groups | pending | 1 | phase-03-orphan-periods.md | | | sets `archivedAt`, no hard delete |
| 4 | Pass 3: prune notification log entries older than retention window | pending | 1 | phase-04-old-notifications.md | | | optional; default retention 365 days |
| 5 | Pass 4: rebuild stale indexes and run `compact` | pending | 2,3,4 | phase-05-indexes-and-compact.md | | | online ops, off-hours |
| 6 | Production execution log + retro | pending | 2,3,4,5 | phase-06-prod-log.md | | | manual; final receipt |
