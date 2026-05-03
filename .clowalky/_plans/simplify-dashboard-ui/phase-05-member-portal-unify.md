# Phase 5 — Unify member portal

## Goal
Today, members see two different UIs depending on whether they're logged in: token-only at `/member/[token]` (standalone, no shell) and a limited group detail at `/dashboard/groups/[groupId]` for accountholders. Merge to one experience: the token route renders the same React tree as the in-shell view, with a thin auth wrapper that injects either `session` or `portalToken` as the identity.

## Scope
- Extract the member-facing parts of group detail into `src/components/features/groups/member-group-experience.tsx` (server component that takes `{ group, billingPeriods, identity: { type: "session" | "portal", id, displayName } }`).
- Use it from both `src/app/(public)/member/[token]/page.tsx` and the member branch of `src/app/(dashboard)/dashboard/groups/[groupId]/page.tsx` (still gated by `MemberGroupView`).
- Preserve the standalone (no sidebar) layout for the `/member/[token]` route — only the inner view is shared, not the outer shell.
- Self-confirm action: keep the existing dual-auth `POST /api/groups/[groupId]/billing/[periodId]/self-confirm` endpoint; ensure both invocation paths use the same client component.

## Scope OUT
- Auth migration to n450s_auth (handled by a separate plan; this phase does not assume any change to current `auth()` semantics).
- Adding member-facing settings.

## Files to touch
- `src/components/features/groups/member-group-experience.tsx` (NEW)
- `src/app/(public)/member/[token]/page.tsx`
- `src/app/(dashboard)/dashboard/groups/[groupId]/page.tsx`
- `src/components/features/groups/member-group-view.tsx` (becomes a thin wrapper around the new component)

## Acceptance criteria
- [ ] A logged-in member visiting `/dashboard/groups/[groupId]` sees the same body content as the token-only `/member/[token]` page.
- [ ] Self-confirm works in both contexts.
- [ ] No styling regressions; the standalone token page still has no sidebar.

## Manual verification
- `pnpm dev` → log in as a member → open a group you don't admin → confirm a payment.
- Open the corresponding token URL in an incognito window → confirm a payment from there too.
- `pnpm lint` clean; `pnpm test` green.
