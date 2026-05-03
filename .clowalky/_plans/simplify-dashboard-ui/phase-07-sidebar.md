# Phase 7 — Sidebar slim-down

## Goal
The sidebar today carries Dashboard, Groups, Delivery log, Scheduled sends, Payments, Notifications, Settings + a per-group list + user menu — too many top-level entries for an app whose primary use is "manage 2-5 groups". Slim to: **My groups** (collapsible list), **Activity**, **Settings**. Move Scheduled sends + Payments + Notifications hub under a single "Admin tools" submenu (only visible to admins) for occasional use.

## Scope
- Refactor `src/components/layout/app-sidebar.tsx`:
  - Remove the standalone "Dashboard" link (since `/dashboard` *is* the groups list now).
  - Top section: `My groups` — list of group names, each linking to `/dashboard/groups/[groupId]`. "+ New group" CTA at the bottom of the list.
  - Middle section: `Activity` link → `/dashboard/activity`.
  - Bottom section: `Settings` (always visible) and `Admin tools` (collapsible, contains: Notifications hub, Scheduled sends, Payments).
- Make sure mobile sheet menu mirrors the same structure.

## Scope OUT
- Renaming routes — keep URLs stable.

## Files to touch
- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/app-shell.tsx` (only if mobile sheet mirrors via a separate file)

## Acceptance criteria
- [ ] Sidebar shows three sections (My groups, Activity, Settings + Admin tools).
- [ ] All previous links still reachable in 1–2 clicks.
- [ ] Active-route highlighting still works.
- [ ] Mobile menu shows the same structure.

## Manual verification
- `pnpm dev` → resize to mobile → open menu → same structure.
- All sidebar links navigate correctly.
- `pnpm lint` clean.
