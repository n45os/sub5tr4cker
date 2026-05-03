# Phase 9 — Smoke pass + screenshot diff

## Goal
End-to-end manual smoke after all the UI surgery: log in, hit every common path, confirm nothing regressed.

## Scope
- Run `pnpm dev`, log in as the admin, walk through the click budgets in `target-ui.md`:
  - View groups (1 click — `/dashboard`).
  - Notify unpaid (1 click on group card).
  - Open a group (1 click).
  - Confirm a payment (matrix → click).
  - Bulk-confirm a period (1 click).
  - View activity (sidebar → activity).
  - Send a test reminder via the notifications hub.
- Repeat the member journey with a non-admin account: open a group, self-confirm a payment.
- Repeat the same self-confirm via the `/member/[token]` URL in incognito.
- Take screenshots of each landing page and drop them in `.clowalky/_plans/simplify-dashboard-ui/screenshots/` as evidence.

## Scope OUT
- Any code changes — pure verification phase.

## Files to touch
- `.clowalky/_plans/simplify-dashboard-ui/screenshots/` (new dir, screenshots only)
- `.clowalky/_plans/simplify-dashboard-ui/phase-09-results.md` (NEW — record of what was tested)

## Acceptance criteria
- [ ] Every click-budget item from `target-ui.md` is met.
- [ ] No console errors during the smoke walk.
- [ ] Screenshots captured.
- [ ] `phase-09-results.md` records pass/fail per checklist item.

## Manual verification
- See acceptance criteria — this phase is itself the verification.
