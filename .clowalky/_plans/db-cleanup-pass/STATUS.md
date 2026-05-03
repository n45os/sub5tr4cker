| ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
|----|-------|--------|------------|-------|---------|-----------|-------|
| 0 | Inventory: enumerate cleanup candidates from prod DB | complete | — | phase-00-inventory.md | 2026-05-03 | 2026-05-03 | inventory written into the brief itself (see file). Counts: 6 orphan billingperiods (all under inactive group `69bac59addf7b647fbfdbde4`); 2 duplicate-billingperiod buckets (defer to `fix-duplicate-billing-periods/4` cleanup script); 0 across orphan-tasks / old-notifications / stale-locks / old-audit-events. Phase 1 should target exactly one mutation: archive the 6 orphan billingperiods. operator-advanced via advance-operator-blocks. |
| 1 | Build a `dbcleanup` CLI script with dry-run as default | complete | 0 | phase-01-cleanup-script.md | 2026-05-03 | 2026-05-03 | harness only — passes are stubs as briefed; no new StorageAdapter methods needed yet (deferred to phases 2/3/4 when real logic lands). `pnpm db:cleanup` runs `tsx scripts/db-cleanup.ts`. `--apply` without a pass flag exits 2. |
| 2 | Pass 1: cancel scheduled tasks pointing at deleted groups/periods | pending | 1 | phase-02-orphan-tasks.md | | | reversible (status flip only) |
| 3 | Pass 2: archive billing periods for soft-deleted groups | pending | 1 | phase-03-orphan-periods.md | | | sets `archivedAt`, no hard delete |
| 4 | Pass 3: prune notification log entries older than retention window | pending | 1 | phase-04-old-notifications.md | | | optional; default retention 365 days |
| 5 | Pass 4: rebuild stale indexes and run `compact` | pending | 2,3,4 | phase-05-indexes-and-compact.md | | | online ops, off-hours |
| 6 | Production execution log + retro | pending | 2,3,4,5 | phase-06-prod-log.md | | | manual; final receipt |
