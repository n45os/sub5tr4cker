# Phase 2 — Insights strip cleanup

## Goal
The bag of components moved into `<DashboardInsights />` in phase 1 is too noisy. Slim it to a single horizontal strip of the metrics that actually inform action: open billing periods, unpaid count across all groups, last reminder sent. Drop the "hidden no more" callouts (now redundant with the slim sidebar) and the workspace-pulse list (replaced by `/dashboard/activity`).

## Scope
- In `src/components/features/dashboard/dashboard-insights.tsx`, render only:
  - One row of 3–4 metric tiles (open periods, unpaid amount, members owing, last reminder send time).
  - A single "View activity →" link to `/dashboard/activity`.
- Delete or move the rest of the demoted components into `src/components/features/dashboard/_archive/` (untouched) — leave a one-line stub per file that re-exports from the archive so we can revert quickly if needed. Easier alternative: just delete; the git history is the audit trail.
- The disclosure stays collapsed by default.

## Scope OUT
- Activity feed itself (phase 8).
- Group card actions (phase 3).

## Files to touch
- `src/components/features/dashboard/dashboard-insights.tsx`
- Any of the demoted components in `src/components/features/dashboard/` that get retired (delete or archive)

## Acceptance criteria
- [ ] Insights strip is one short row of tiles + one link.
- [ ] No unused imports left over.
- [ ] No 404s from links that pointed at deleted features.

## Manual verification
- `pnpm dev` → expand insights → see one row of tiles.
- `pnpm lint` clean.
- Search the codebase for references to retired components — none remain (except in archive if you went that route).
