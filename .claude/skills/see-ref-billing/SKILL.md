---
name: see-ref-billing
description: Reference for the Billing module — code map, entrypoints, conventions. Load explicitly when working on billing/payments.
---

# Billing module reference

## Purpose
Automates monthly cost-splitting and payment tracking per group. Generates `BillingPeriod` rows on schedule, calculates per-member shares (equal/fixed/variable), tracks the `pending → member_confirmed → confirmed` lifecycle, and exposes admin overrides (waive, recalc, backfill, import).

## Main functionalities
- Period generation — automatic monthly creation when the cycle day arrives
- Cost calculation — equal split, fixed amount per member, or variable (price-per-period)
- Payment tracking — per-member status with HMAC confirmation tokens
- Collection window — `paymentInAdvanceDays` shifts when reminders become eligible
- Admin verification — 2-step (member self-confirms → admin verifies/rejects)
- Backfill & import — manual periods and historical data
- Recalculation — refresh shares when roster or admin split settings change
- Overdue reconciliation — `pending → overdue` after the configured grace

## Code map

### Domain logic
- [src/lib/billing/calculator.ts](src/lib/billing/calculator.ts) — `calculateShares()`, `getPeriodDates()`, `formatPeriodLabel()`
- [src/lib/billing/periods.ts](src/lib/billing/periods.ts) — `createPeriodIfDue()` (cycle math + dedup guard)
- [src/lib/billing/collection-window.ts](src/lib/billing/collection-window.ts) — `getCollectionOpensAt()`, `collectionWindowOpenFilter()`
- [src/lib/billing/backfill.ts](src/lib/billing/backfill.ts) — `recalculatePeriodPayments()`, member-add backfill, removal credit
- [src/lib/billing/period-display.ts](src/lib/billing/period-display.ts) — UI ordering helpers

### API routes
- [src/app/api/groups/[groupId]/billing/route.ts](src/app/api/groups/[groupId]/billing/route.ts) — list (GET) + manual create (POST, 409 on conflict)
- [src/app/api/groups/[groupId]/billing/[periodId]/confirm/route.ts](src/app/api/groups/[groupId]/billing/[periodId]/confirm/route.ts) — admin verify
- [src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts](src/app/api/groups/[groupId]/billing/[periodId]/self-confirm/route.ts) — member declares paid
- [src/app/api/groups/[groupId]/billing/[periodId]/recalculate/route.ts](src/app/api/groups/[groupId]/billing/[periodId]/recalculate/route.ts)
- [src/app/api/groups/[groupId]/billing/reconcile/route.ts](src/app/api/groups/[groupId]/billing/reconcile/route.ts), [advance/route.ts](src/app/api/groups/[groupId]/billing/advance/route.ts), [backfill/route.ts](src/app/api/groups/[groupId]/billing/backfill/route.ts), [import/route.ts](src/app/api/groups/[groupId]/billing/import/route.ts)
- [src/app/api/cron/billing/route.ts](src/app/api/cron/billing/route.ts) — HTTP cron entry

### Cron + jobs
- [src/jobs/check-billing-periods.ts](src/jobs/check-billing-periods.ts) — loops active groups, calls `createPeriodIfDue()`
- [src/jobs/runner.ts](src/jobs/runner.ts) — schedules `checkBillingPeriods()` daily at 00:00

### Models / storage
- [src/models/billing-period.ts](src/models/billing-period.ts) — schema, unique index `{ group: 1, periodStart: 1 }`
- [src/lib/storage/mongoose-adapter.ts](src/lib/storage/mongoose-adapter.ts) — `getBillingPeriodByStart`, `createBillingPeriod`, `updateBillingPeriod`, `updatePaymentStatus`
- [src/lib/storage/sqlite-adapter.ts](src/lib/storage/sqlite-adapter.ts) — same surface, JSON columns, `idx_bp_group_start` UNIQUE

### UI
- [src/components/features/billing/payment-matrix.tsx](src/components/features/billing/payment-matrix.tsx)
- [src/components/features/billing/member-payment-list.tsx](src/components/features/billing/member-payment-list.tsx)
- [src/components/features/billing/no-periods-card.tsx](src/components/features/billing/no-periods-card.tsx)

## Key entrypoints
1. [src/jobs/check-billing-periods.ts:5](src/jobs/check-billing-periods.ts:5) — daily orchestrator
2. [src/lib/billing/periods.ts:12](src/lib/billing/periods.ts:12) — core period creation; `getBillingPeriodByStart()` guard
3. [src/lib/billing/calculator.ts:90](src/lib/billing/calculator.ts:90) — `getPeriodDates()` from year/month/cycleDay
4. [src/models/billing-period.ts:87](src/models/billing-period.ts:87) — Mongoose unique index
5. [src/app/api/groups/[groupId]/billing/route.ts:225](src/app/api/groups/[groupId]/billing/route.ts:225) — POST also calls `getBillingPeriodByStart()` before insert
6. [src/lib/billing/collection-window.ts:16](src/lib/billing/collection-window.ts:16) — `getCollectionOpensAt()` applies advance offset

## Module-specific conventions
- **Period uniqueness key**: `(groupId, periodStart)` — enforced via Mongoose `unique: true` index AND SQLite `idx_bp_group_start`. Callers should still query first since both adapters throw on collision (Mongoose `E11000`, SQLite `UNIQUE constraint failed`).
- **`collectionOpensAt`**: `periodStart - paymentInAdvanceDays`. Filters use `COALESCE(collection_opens_at, period_start)` for legacy rows.
- **Confirmation tokens**: HMAC over `(memberId, periodId, groupId)`; verified without DB lookup.
- **Active members for share calc**: filter by `m.isActive && !m.leftAt && billingStartsAt <= periodStart`.

## Cross-cutting
- **Scheduled tasks emitted**: `payment_reminder`, `aggregated_payment_reminder` (via `src/jobs/enqueue-reminders.ts`); `admin_confirmation_request` (via member self-confirm + `src/jobs/enqueue-follow-ups.ts`)
- **Audit events**: `payment_self_confirmed`, `payment_confirmed`, `payment_rejected`, `period_created`, `period_recalculated`
- **Settings keys**: `security.cronSecret` for cron routes; per-group `billing.gracePeriodDays`, `paymentInAdvanceDays`, `mode`, `cycleDay`
- **Telegram callbacks**: `confirm:`, `paydetails:`, `admin_confirm:`, `admin_reject:`, `snooze:`

## Gotchas
- **Duplicate-period root cause (active bug)**: `createPeriodIfDue()` calls `now.getMonth()` / `now.getFullYear()` which return *local* values for a UTC-based `Date`. On a non-UTC server the month flips at the local-midnight boundary, so the same calendar month can be derived twice across cron ticks (e.g. once when local says April 30 and once when local says May 1). Compounding: `getPeriodDates(year, month, cycleDay)` builds `new Date(year, month, cycleDay)` which is also local-time → `periodStart` Date objects can differ across runs, slipping past the `(group, periodStart)` unique index. **Fix**: use `now.getUTCFullYear()` / `now.getUTCMonth()` and either `Date.UTC(...)` or a date-only string in `getPeriodDates()`.
- `getBillingPeriodByStart()` is a query-then-create guard, not an upsert. Concurrent cron runners can both see `null` and race; the unique index catches it but raises an error you must handle.
- Backfill and member-removal flows recompute *all* open periods — slow on large histories.
- `customAmount` *overrides* `fixedMemberAmount` in fixed mode (not additive).
- Adding members with a past `billingStartsAt` triggers automatic backfill across past periods + a credit summary for other members.

## Related modules
- `see-ref-jobs` — schedules period creation and reminders
- `see-ref-notifications` — dispatches reminders/follow-ups for periods
- `see-ref-groups` — billing config + member list embedded
- `see-ref-storage` — adapter is the only DB path
- `see-ref-tokens` — HMAC for confirmation links *(not yet a ref)*

## Updating this ref
When you load this ref and learn something future sessions would benefit from — a new convention, a real gotcha, a refactor that moves files — append it terse and link the path. Don't restate CLAUDE.md.
