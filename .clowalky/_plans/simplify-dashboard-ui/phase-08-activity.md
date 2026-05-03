# Phase 8 — Activity feed default-filter cleanup

## Goal
Drop the activity feed from 13 filter combinations + 2 tabs to the default people actually want: "show recent notifications + admin actions, newest first". Filters stay available behind a "Filters" disclosure.

## Scope
- In `src/app/(dashboard)/dashboard/activity/page.tsx`:
  - Default the source filter to `all`, type filter to `all`, channel filter to `all` — but render filter controls inside a collapsed `<details>` so the page lands on the feed itself.
  - Drop the "Sent & actions / Upcoming" tabs — collapse Upcoming into a small bar at the top ("3 reminders queued in the next 24h →") that links to `/dashboard/scheduled-tasks`.
  - Default page size 25 (unchanged) but show a clearer pagination footer.

## Scope OUT
- Modifying `/api/activity` shape — purely UI.

## Files to touch
- `src/app/(dashboard)/dashboard/activity/page.tsx`

## Acceptance criteria
- [ ] Page lands directly on the feed, no decision required.
- [ ] Filter UI exists but is collapsed by default.
- [ ] Upcoming-reminders summary bar at the top.

## Manual verification
- `pnpm dev` → visit `/dashboard/activity` → see feed first.
- Expand filters → all previous controls present.
- `pnpm lint` clean.
