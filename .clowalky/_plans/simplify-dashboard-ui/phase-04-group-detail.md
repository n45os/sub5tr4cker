# Phase 4 — Group detail consolidation

## Goal
Collapse the group detail page from "header + 5 stat cards + matrix + collapsible notifications + members panel + billing setup + workflow explainer + invite link" into a tight 3-section scroll: **(1) at-a-glance + actions**, **(2) billing & payments**, **(3) members & invites**. No more nested collapsibles for the most common tasks.

## Scope
- Refactor `src/app/(dashboard)/dashboard/groups/[groupId]/page.tsx` to render three top-level `<section>`s:
  - At-a-glance: name, service, price, cycle, unpaid count, next billing date, primary actions (Notify unpaid, Edit, ⋯ menu).
  - Billing & payments: the full billing matrix — not the 6-period preview. Drop the separate `/dashboard/groups/[groupId]/billing/page.tsx` route (or redirect it here).
  - Members & invites: members panel + invite link card. The notification toggles move into a single inline accordion at the bottom (admins rarely toggle them).
- Delete the "what happens next" workflow explainer card — it duplicates docs.
- The 5 stat cards become inline subline text (e.g. "€11.99 · 5 members · Cycle day 1").

## Scope OUT
- Member-portal unification (phase 5).
- Bulk confirm UX (phase 6).

## Files to touch
- `src/app/(dashboard)/dashboard/groups/[groupId]/page.tsx`
- `src/app/(dashboard)/dashboard/groups/[groupId]/billing/page.tsx` (delete or redirect)
- `src/components/features/billing/payment-matrix.tsx` (remove the "6 periods preview" mode if unused)
- `src/components/features/groups/group-detail-admin-actions.tsx` (header actions condense)

## Acceptance criteria
- [ ] Three sections are visible in one scroll on a desktop viewport (no need to expand a panel for the matrix).
- [ ] No nested collapsibles for billing or members.
- [ ] The dedicated billing page either renders this same view or redirects.
- [ ] All admin actions previously under the ⋯ menu still work.

## Manual verification
- `pnpm dev` → open a group with several periods → see matrix inline.
- Confirm a payment from the matrix — works.
- `pnpm lint` clean; `pnpm test` green.
