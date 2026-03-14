---
name: Activity, Payments, Seed
overview: Add an activity log page (sent + upcoming notifications), a payments history page (all payment records across groups), and a seed script that populates 5 months of realistic data for a demo group.
todos:
  - id: seed-script
    content: Create scripts/seed.ts with 5-month demo group, users, billing periods, payments, and notifications. Add pnpm seed script to package.json.
    status: completed
  - id: payments-api
    content: Create GET /api/payments route aggregating payment records across all groups for the authenticated user.
    status: completed
  - id: payments-page
    content: Create /dashboard/payments page with summary cards and filterable payments table.
    status: completed
  - id: activity-api
    content: Create GET /api/activity route returning sent notifications and computed upcoming notifications.
    status: completed
  - id: activity-page
    content: Create /dashboard/activity page with Sent and Upcoming tabs.
    status: completed
  - id: nav-updates
    content: Add Activity and Payments items to sidebar, add header metadata and breadcrumbs for both routes.
    status: completed
  - id: version-bump
    content: Bump version to 0.8.0, update CHANGELOG.md.
    status: completed
isProject: false
---

# Activity Log, Payments Page, and Seed Script

## Context

The app already has:

- A `Notification` model that logs every dispatched message (type, channel, status, recipient, dates)
- `BillingPeriod` with embedded `payments[]` (per-member amounts and statuses) and `reminders[]`
- Cron jobs that create billing periods, send reminders, and send follow-ups on known schedules
- An existing `/api/notifications` endpoint scoped to a single group
- Per-group billing view on the group detail page, but no cross-group payment history

Missing:

- A global activity log page showing all sent notifications + what is scheduled next
- A global payments page showing all payment records across every group the user manages
- A seed script for development/testing

---

## 1. Activity Log Page

**Route**: `/dashboard/activity`

**API**: `GET /api/activity`

Query params: `page`, `limit`, `type` (filter by notification type), `channel` (email/telegram)

Returns two sections:

- `**sent`**: Past notifications from the `Notification` collection, filtered to groups where the current user is admin or active member. Sorted by `createdAt` desc. Paginated.
- `**upcoming**`: Computed from billing periods that have `pending`/`overdue` payments and the group's notification settings. Shows what reminders/follow-ups will fire next based on cron schedules (reminders daily 10:00, follow-ups every 3 days 14:00). Capped to next ~2 weeks.

**Page**: `src/app/(dashboard)/dashboard/activity/page.tsx`

- Server component that fetches from `/api/activity`
- Two-tab layout: "Sent" and "Upcoming"
- Sent tab: table/list with columns: Date, Type badge, Channel icon, Recipient, Group, Subject/Preview, Status
- Upcoming tab: timeline-style list showing predicted next sends with date, group, type, recipient count

**Nav**: Add "Activity" item to sidebar between "Groups" and "Notifications" using `Activity` or `Clock` icon from Lucide.

**Header**: Add `activity` breadcrumb and header metadata in `[app-header.tsx](src/components/layout/app-header.tsx)`.

---

## 2. Payments Page

**Route**: `/dashboard/payments`

**API**: `GET /api/payments`

Query params: `page`, `limit`, `status` (pending/member_confirmed/confirmed/overdue/waived), `groupId`

Aggregates from `BillingPeriod.payments[]` across all groups where the user is admin. Each record joins with the billing period and group info to return: member name, group name, period label, amount, currency, status, confirmed dates.

**Page**: `src/app/(dashboard)/dashboard/payments/page.tsx`

- Server component
- Summary cards at top: total collected, total pending, total overdue
- Filterable table with columns: Period, Group, Member, Amount, Status badge, Member confirmed at, Admin confirmed at
- Filter bar: group dropdown, status filter
- Empty state when no billing periods exist

**Nav**: Add "Payments" item to sidebar after "Activity" using the existing `CreditCard` icon from Lucide (already imported but only used in the sidebar header logo; we can reuse it or use `Wallet`/`Receipt`).

**Header**: Add `payments` breadcrumb and header metadata.

---

## 3. Seed Script

**File**: `scripts/seed.ts`
**Script**: Add `"seed": "tsx scripts/seed.ts"` to `[package.json](package.json)`

Creates:

- **1 admin user**: "Demo Admin" with email `admin@demo.local`, hashed password `demo1234`
- **3 member users**: with emails `alice@demo.local`, `bob@demo.local`, `charlie@demo.local`
- **1 group**: "YouTube Premium Family", equal_split mode, 22.99 EUR, cycle day 1, admin included in split, Revolut payment, all notifications enabled
- **5 billing periods**: Nov 2025 through Mar 2026 (months -4 to 0 relative to today)
  - Oldest 3 periods: all payments `confirmed` with realistic `memberConfirmedAt`/`adminConfirmedAt` dates
  - 4th period: mix of `confirmed` and `member_confirmed` (admin hasn't verified yet)
  - Current period: `pending` payments (just created)
- **Reminder entries** on each billing period (initial + follow_ups for older ones)
- **~30 notification records** matching the billing history: `payment_reminder`, `payment_confirmed`, `admin_confirmation_request`, `follow_up` types across email channel
- Prints a summary and the admin login credentials

Uses `dbConnect()` from `@/lib/db/mongoose` and Mongoose models from `@/models`. Cleans up existing seed data (by email pattern `*@demo.local`) before inserting to make it idempotent.

---

## 4. Navigation and Layout Updates

Files to update:

- `[src/components/layout/app-sidebar.tsx](src/components/layout/app-sidebar.tsx)` - add Activity and Payments nav items
- `[src/components/layout/app-header.tsx](src/components/layout/app-header.tsx)` - add header metadata and breadcrumbs for both new routes

---

## 5. Version Bump

This adds two new user-facing pages and a developer utility script. Warrants a **minor** bump: `0.7.0` -> `0.8.0`.