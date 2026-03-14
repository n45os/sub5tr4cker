---
name: mvp-next-steps
overview: "Align roadmap with actual implementation status and execute the highest-impact MVP gaps in a phased order: core APIs and auth first, then billing/UI, then Telegram and ops hardening."
todos:
  - id: phase-a-groups-members-api
    content: Implement groups and members API routes with auth/db/zod/error conventions
    status: in_progress
  - id: phase-a-billing-api
    content: Implement billing endpoints including member self-confirm and admin confirm flows
    status: pending
  - id: phase-b-auth-dashboard
    content: Add auth pages and initial dashboard pages using new API routes
    status: pending
  - id: phase-c-telegram-cron
    content: Add Telegram webhook/link endpoints and expose follow-ups cron HTTP route
    status: pending
  - id: phase-d-tests-docs-sync
    content: Add critical tests, then sync docs/PLAN and _context to match actual implementation
    status: pending
isProject: false
---

# SubsTrack Next Steps Plan

## Goal

Deliver a usable Phase 1 MVP by implementing missing user-facing flows that are already defined in the roadmap and API design, while keeping existing cron/notification foundations intact.

## Current Reality Check

- Roadmap source of truth: `[/Users/nassos/Developer/subs-track/docs/PLAN.md](/Users/nassos/Developer/subs-track/docs/PLAN.md)`
- API contract to implement: `[/Users/nassos/Developer/subs-track/docs/api-design.md](/Users/nassos/Developer/subs-track/docs/api-design.md)`
- Data model reference: `[/Users/nassos/Developer/subs-track/docs/data-models.md](/Users/nassos/Developer/subs-track/docs/data-models.md)`
- Already in place: auth handler, confirm token flow, billing/reminder cron routes, notification service, telegram helpers, core models
- Biggest missing pieces: groups/members/billing APIs, dashboard/auth pages, telegram webhook/link routes, follow-ups cron HTTP trigger

## Phase A — Core API Surface (highest priority)

Implement the minimum API layer needed for a working dashboard and payment workflow.

- Build groups CRUD routes under `[/Users/nassos/Developer/subs-track/src/app/api/groups](/Users/nassos/Developer/subs-track/src/app/api/groups)`
- Build members management routes under `[/Users/nassos/Developer/subs-track/src/app/api/groups/[groupId]/members](/Users/nassos/Developer/subs-track/src/app/api/groups/[groupId]/members)`
- Build billing routes under `[/Users/nassos/Developer/subs-track/src/app/api/groups/[groupId]/billing](/Users/nassos/Developer/subs-track/src/app/api/groups/[groupId]/billing)`
- Add admin confirmation endpoint and member self-confirm endpoint per API design
- For each protected route: use `auth()` + `dbConnect()` + Zod request validation + standard `{ data }` / `{ error }` response shape

## Phase B — Auth + Dashboard UX

Make the product operable for real users.

- Add login/register pages in `[/Users/nassos/Developer/subs-track/src/app/(auth)](/Users/nassos/Developer/subs-track/src/app/(auth)`)
- Implement credentials auth path in `[/Users/nassos/Developer/subs-track/src/lib/auth.ts](/Users/nassos/Developer/subs-track/src/lib/auth.ts)` (currently placeholder)
- Add initial dashboard pages in `[/Users/nassos/Developer/subs-track/src/app/(dashboard)](/Users/nassos/Developer/subs-track/src/app/(dashboard)`):
  - group list
  - group detail with current billing period
  - basic member payment status view
- Start feature UI modules in `[/Users/nassos/Developer/subs-track/src/components/features](/Users/nassos/Developer/subs-track/src/components/features)` for groups and billing

## Phase C — Telegram + Cron Completeness

Close the integration gaps so background automation matches docs.

- Add Telegram webhook route in `[/Users/nassos/Developer/subs-track/src/app/api/telegram/webhook](/Users/nassos/Developer/subs-track/src/app/api/telegram/webhook)`
- Add Telegram account-link route in `[/Users/nassos/Developer/subs-track/src/app/api/telegram/link](/Users/nassos/Developer/subs-track/src/app/api/telegram/link)`
- Add follow-ups cron endpoint in `[/Users/nassos/Developer/subs-track/src/app/api/cron/follow-ups/route.ts](/Users/nassos/Developer/subs-track/src/app/api/cron/follow-ups/route.ts)` to expose existing `send-follow-ups` job
- Wire/start telegram handlers from `[/Users/nassos/Developer/subs-track/src/lib/telegram/handlers.ts](/Users/nassos/Developer/subs-track/src/lib/telegram/handlers.ts)` in the chosen runtime mode (webhook-first)

## Phase D — Validation and Documentation Sync

Stabilize and make roadmap tracking truthful.

- Add route-level tests for critical APIs and payment state transitions
- Verify cron endpoints with `CRON_SECRET` and idempotency behavior
- Update checklist status in `[/Users/nassos/Developer/subs-track/docs/PLAN.md](/Users/nassos/Developer/subs-track/docs/PLAN.md)` to reflect implemented items
- Fill `_context` gaps in `[/Users/nassos/Developer/subs-track/_context/context.md](/Users/nassos/Developer/subs-track/_context/context.md)` and related context docs

## Suggested Execution Order

1. Groups + members API
2. Billing API + payment status update endpoints
3. Auth pages + credentials flow
4. Dashboard group list/detail screens
5. Telegram webhook/link + follow-ups cron route
6. Test pass and docs/context sync

