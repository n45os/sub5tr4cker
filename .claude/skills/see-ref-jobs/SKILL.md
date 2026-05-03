---
name: see-ref-jobs
description: Reference for the Jobs + Scheduled-Tasks queue — cron runner, enqueue, worker, idempotency. Load explicitly when working on cron jobs or the task queue.
---

# Jobs + scheduled tasks reference

## Purpose
Two cooperating systems: a **node-cron runner** (`src/jobs/runner.ts`) that fires reconciliation jobs daily and a **persisted task queue** (`ScheduledTask`) that holds notification work. Reconciliation creates/repairs billing periods; reminder cron enqueues tasks; the worker claims tasks with optimistic locks and runs them, skipping any whose underlying payment has since been confirmed.

## Main functionalities
- Cron schedule (`runner.ts`):
  - Billing periods — daily 00:00
  - Enqueue reminders + run worker — daily 10:00
  - Reconcile overdue + enqueue follow-ups + run worker — every 3 days 14:00
  - Worker only — every 5 minutes
- Billing-period reconciliation (`check-billing-periods.ts`)
- Enqueue payment reminders (`enqueue-reminders.ts`) — single or aggregated based on `notifications.aggregateReminders`
- Enqueue admin follow-ups (`enqueue-follow-ups.ts` + `send-follow-ups.ts` orchestrator)
- Worker (`src/lib/tasks/worker.ts`) — claim, dispatch, complete/fail with exponential backoff
- Admin queue UI: list / cancel pending+locked / retry failed / bulk-cancel
- Three task types only: `payment_reminder`, `aggregated_payment_reminder`, `admin_confirmation_request`

## Code map

### Cron entry
- [src/jobs/runner.ts](src/jobs/runner.ts) — node-cron schedule, registers all jobs

### Job functions
- [src/jobs/check-billing-periods.ts](src/jobs/check-billing-periods.ts)
- [src/jobs/enqueue-reminders.ts](src/jobs/enqueue-reminders.ts)
- [src/jobs/enqueue-follow-ups.ts](src/jobs/enqueue-follow-ups.ts)
- [src/jobs/send-follow-ups.ts](src/jobs/send-follow-ups.ts) — overdue reconcile + enqueue
- [src/jobs/reconcile-overdue.ts](src/jobs/reconcile-overdue.ts)
- [src/jobs/run-notification-tasks.ts](src/jobs/run-notification-tasks.ts) — wraps worker for HTTP/cron callers

### Worker + queue
- [src/lib/tasks/worker.ts](src/lib/tasks/worker.ts) — `executeTask()` dispatcher + `runWorkerBatch()`
- [src/lib/tasks/queue.ts](src/lib/tasks/queue.ts) — `enqueueTask`, `claimTasks`, `completeTask`, `failTask`
- [src/lib/tasks/idempotency.ts](src/lib/tasks/idempotency.ts) — day-scoped key builders

### Model + storage
- [src/models/scheduled-task.ts](src/models/scheduled-task.ts) — schema + `idempotencyKey UNIQUE` + `(status, runAt)` index
- [src/lib/storage/adapter.ts](src/lib/storage/adapter.ts) — task surface (`enqueueTask`, `claimTasks`, `completeTask`, `failTask`, `bulkCancel`, `listTasks`, `getTaskCounts`)
- [src/lib/storage/mongoose-adapter.ts](src/lib/storage/mongoose-adapter.ts) — claim with stale-lock recovery (`lockedAt < now - 5min` → back to pending)

### API
- [src/app/api/cron/billing/route.ts](src/app/api/cron/billing/route.ts), [reminders/route.ts](src/app/api/cron/reminders/route.ts), [follow-ups/route.ts](src/app/api/cron/follow-ups/route.ts), [notification-tasks/route.ts](src/app/api/cron/notification-tasks/route.ts)
- [src/app/api/scheduled-tasks/route.ts](src/app/api/scheduled-tasks/route.ts), [bulk-cancel/route.ts](src/app/api/scheduled-tasks/bulk-cancel/route.ts), [[taskId]/route.ts](src/app/api/scheduled-tasks/[taskId]/route.ts)

### UI
- [src/app/(dashboard)/dashboard/scheduled-tasks/](src/app/(dashboard)/dashboard/scheduled-tasks)

## Key entrypoints
1. [src/jobs/runner.ts:12](src/jobs/runner.ts:12) — cron registrations (the schedule contract)
2. [src/lib/tasks/worker.ts:18](src/lib/tasks/worker.ts:18) — `executeTask()` dispatcher
3. [src/lib/tasks/queue.ts:22](src/lib/tasks/queue.ts:22) — `enqueueTask()` (idempotency lives here)
4. [src/lib/tasks/idempotency.ts:7](src/lib/tasks/idempotency.ts:7) — key formats
5. [src/app/api/cron/notification-tasks/route.ts:11](src/app/api/cron/notification-tasks/route.ts:11) — frequent worker entry (every 5 min)

## Module-specific conventions
- **Idempotency key shape**: `<type>:<scopeIds...>:<day>` where `day = runAt.toISOString().slice(0,10)`. Re-enqueue on the same day is a no-op.
- **Claim pattern**: `findOneAndUpdate({ _id, status: "pending" }, { status: "locked", lockedAt, lockedBy })` — atomic optimistic lock. Stale-lock sweep (`updateMany`) before claiming.
- **Worker skip**: `executeTask()` reloads payment from DB before sending; if no longer unpaid, marks `completed` immediately (CLAUDE.md confirms this is the intended behaviour).
- **Cron secret**: every cron route checks `request.headers.get("x-cron-secret")` against `getSetting("security.cronSecret")`.
- **Backoff**: exponential, capped at 24 hours.

## Cross-cutting
- Notifications (executes them via `sendReminderForPayment`, `sendAggregatedReminder`, `sendAdminConfirmationNudge`)
- Billing (reads open periods + payment status before send)
- Settings (`security.cronSecret`, `notifications.aggregateReminders`)

## Gotchas
- **`createPeriodIfDue()` race + timezone bug**: `now.getMonth()` / `getFullYear()` are *local*, so on a non-UTC server the calendar month flips at the local-midnight boundary. The `getBillingPeriodByStart()` guard is query-then-create — the `(group, periodStart)` UNIQUE index does catch true duplicates, but the timezone bug can produce *different* `periodStart` Date objects for what is logically the same month, slipping past the index. See `see-ref-billing` for the full root-cause analysis and the fix (use `getUTCFullYear`/`getUTCMonth` and `Date.UTC(...)`).
- **No transactions across `createBillingPeriod` → `enqueueTask`** — if period creates and enqueue fails, you'll have a period with no reminder. Cron re-run repairs it (next day).
- **Aggregation falls back email → memberId**, so a member with multiple emails across periods doesn't aggregate cleanly.
- **Reconcile-overdue full scans** `listUnpaidPeriodsWithStartBefore()` (no status index). O(n) but only runs every 3 days.
- **Local mode**: cron only runs when `pnpm cron` (or the runner inside `s54r start` background loop) is up — not as part of `next start`.

## Related modules
- `see-ref-billing` — periods are the input
- `see-ref-notifications` — sends are the output
- `see-ref-storage` — task persistence + claim semantics

## Updating this ref
If a new task type is added (rare — production has only three), update the "Main functionalities" list and the worker dispatcher entry.
