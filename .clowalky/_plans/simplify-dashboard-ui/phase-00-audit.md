# Phase 0 — UX audit + target-flow doc

## Goal
Write a short markdown spec that captures the *target* UI: what the user sees on each route after the simplification, and the click-count budget for every common action (view groups, send reminder, confirm payment, see activity, change settings). All later phases reference this doc.

## Scope
- Read the relevant pages with the `see-ref-ui` skill loaded.
- Inventory every duplicated surface and decide which one survives.
- Write `.clowalky/_plans/simplify-dashboard-ui/target-ui.md` with sections:
  - **Routes after simplification** (what each page shows, in plain language).
  - **Click budgets** (one-liner per task: "send reminder = 1 click from /dashboard", etc.).
  - **What we delete or hide** (named components / sections that go away).
  - **What stays unchanged** (explicit, so phases don't accidentally touch it).
- No code changes in this phase.

## Files to touch
- `.clowalky/_plans/simplify-dashboard-ui/target-ui.md`

## Acceptance criteria
- [ ] `target-ui.md` exists with all four sections filled in.
- [ ] Every later phase brief can quote a specific line from `target-ui.md` to justify its changes.

## Manual verification
- A second person (or future-you) can read `target-ui.md` cold and explain what each route does.
