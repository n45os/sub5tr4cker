# Phase 3 — Group card quick actions

## Goal
Cut the click-budget for "send reminders for this group" from 4 clicks to 1. Add inline quick actions on every `<GroupCard />` so the admin can notify unpaid members or jump into billing without opening the group detail page.

## Scope
- In `src/components/features/groups/GroupCard.tsx`, add a footer row with:
  - "Notify unpaid (N)" button — disabled when N=0, calls `POST /api/dashboard/notify-unpaid` with `{ groupIds: [groupId] }`, shows a toast on success.
  - "View billing" link → `/dashboard/groups/[groupId]/billing`.
  - The existing "Open" link to group detail stays (primary affordance).
- Show the unpaid count + next billing date as a sub-line under the service name, not as separate cards.
- Telemetry / audit: rely on the existing `POST /api/dashboard/notify-unpaid` flow — no new endpoint.

## Scope OUT
- Group detail page (phase 4).
- Bulk multi-group notify on the home (out of scope for this plan).

## Files to touch
- `src/components/features/groups/GroupCard.tsx`
- `src/components/features/groups/group-card-actions.tsx` (NEW client component for the buttons + toast)

## Acceptance criteria
- [ ] Each group card shows "Notify unpaid (N)" and "View billing" alongside "Open".
- [ ] Clicking "Notify unpaid" sends a real notification (not just a toast).
- [ ] When N=0, the button is disabled with a tooltip "No unpaid members".
- [ ] No layout regressions on small screens (cards stack cleanly).

## Manual verification
- `pnpm dev` → visit `/dashboard` → see new actions.
- Notify unpaid for a group with unpaid members → email/Telegram fires (check logs / inbox).
- `pnpm lint` clean; `pnpm test` green.
