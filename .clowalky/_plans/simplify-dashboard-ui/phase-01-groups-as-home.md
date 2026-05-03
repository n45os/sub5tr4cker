# Phase 1 — Make groups the home

## Goal
`/dashboard` becomes the groups grid. The current dashboard home (stat cards, admin services table, "hidden no more" callouts, workspace pulse) gets demoted into a collapsible insights strip (phase 2). This is the headline UX change the user asked for: "the groups should be accessible from the home screen."

## Scope
- Convert `src/app/(dashboard)/dashboard/page.tsx` into a thin shell that renders the same content as the current `/dashboard/groups` page.
- Move the existing dashboard-home components (admin services table, action shortcuts, "hidden no more" cards, workspace pulse) into a new `<DashboardInsights />` server component imported at the top of the new home page — but render it collapsed by default behind a single "Show insights" disclosure (a `<details>` or shadcn `Collapsible`).
- Delete `src/app/(dashboard)/dashboard/groups/page.tsx` (replaced by the home) — or convert it into a redirect to `/dashboard` to preserve any deep links.
- Update sidebar nav: "Dashboard" link still points at `/dashboard`; remove the now-redundant "Groups" entry (or alias it to the same route).
- Keep the "+ New group" CTA prominent (it was on the home originally; surface it at the top of the grid).

## Scope OUT
- Tweaking the insights strip itself (phase 2).
- Group card layout changes (phase 3).
- Group detail page (phase 4).

## Files to touch
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/dashboard/groups/page.tsx` (delete or convert to redirect)
- `src/components/layout/app-sidebar.tsx`
- `src/components/features/dashboard/dashboard-insights.tsx` (NEW — bundles the demoted home sections)

## Acceptance criteria
- [ ] Visiting `/dashboard` immediately shows the groups grid above the fold.
- [ ] All previous dashboard-home content is reachable in one click via the insights disclosure.
- [ ] `/dashboard/groups` either renders the same view or redirects to `/dashboard` (no broken link).
- [ ] Sidebar no longer shows two routes for "all my groups".
- [ ] No regressions in middleware auth (still requires login).

## Manual verification
- `pnpm dev` → log in → land on `/dashboard` → see groups grid first.
- Click "Show insights" → insights expand inline.
- Verify `/dashboard/groups` still works (redirect or same page).
- `pnpm lint` clean; `pnpm test` green.
