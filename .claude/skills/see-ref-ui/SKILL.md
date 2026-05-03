---
name: see-ref-ui
description: Reference for the UI / dashboard module — layout shell, route segments, feature components, simplification hotspots. Load explicitly when working on UI.
---

# UI / dashboard module reference

## Purpose
Tailwind + shadcn/ui sidebar dashboard for admins (groups, billing, payments, activity, notifications, scheduled tasks, settings) plus a member-facing portal for non-admin views. Two distinct member surfaces today: a logged-in `(dashboard)` view (limited group detail) and a token-only standalone `/member/[token]` page.

## Main functionalities
- Group management — list, create, edit, soft-delete, initialize
- Group detail with billing matrix (6 periods preview) + dedicated billing page
- Global payments table with status filters
- Activity feed (sent notifications + audit events) with channel/source filters
- Notifications hub (workspace email + Telegram setup, template previews)
- Scheduled tasks queue (admin: list / cancel / retry / bulk-cancel)
- Settings (workspace config, API keys, plugins)
- Profile (email, password, prefs, Telegram link, unsubscribe)
- Member portal (guest token + logged-in member view)

## Code map

### Layout (shell)
- [src/components/layout/app-shell.tsx](src/components/layout/app-shell.tsx) — `SidebarProvider` + `AppSidebar` + `AppHeader`
- [src/components/layout/app-sidebar.tsx](src/components/layout/app-sidebar.tsx) — workspace nav + per-group list + user menu
- [src/components/layout/app-header.tsx](src/components/layout/app-header.tsx)
- [src/app/(dashboard)/layout.tsx](src/app/(dashboard)/layout.tsx) — auth guard + sidebar group fetch

### Pages (route segments)
- [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx) — dashboard home
- [src/app/(dashboard)/dashboard/groups/page.tsx](src/app/(dashboard)/dashboard/groups/page.tsx) — groups list
- [src/app/(dashboard)/dashboard/groups/[groupId]/page.tsx](src/app/(dashboard)/dashboard/groups/[groupId]/page.tsx) — admin OR member view (conditional)
- [src/app/(dashboard)/dashboard/groups/[groupId]/edit/page.tsx](src/app/(dashboard)/dashboard/groups/[groupId]/edit/page.tsx)
- [src/app/(dashboard)/dashboard/groups/[groupId]/billing/page.tsx](src/app/(dashboard)/dashboard/groups/[groupId]/billing/page.tsx)
- [src/app/(dashboard)/dashboard/payments/page.tsx](src/app/(dashboard)/dashboard/payments/page.tsx)
- [src/app/(dashboard)/dashboard/activity/page.tsx](src/app/(dashboard)/dashboard/activity/page.tsx)
- [src/app/(dashboard)/dashboard/notifications/page.tsx](src/app/(dashboard)/dashboard/notifications/page.tsx)
- [src/app/(dashboard)/dashboard/scheduled-tasks/page.tsx](src/app/(dashboard)/dashboard/scheduled-tasks/page.tsx)
- [src/app/(dashboard)/dashboard/settings/page.tsx](src/app/(dashboard)/dashboard/settings/page.tsx)
- [src/app/(dashboard)/dashboard/profile/page.tsx](src/app/(dashboard)/dashboard/profile/page.tsx)
- [src/app/(public)/member/[token]/page.tsx](src/app/(public)/member/[token]/page.tsx) — guest portal
- [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx), [register/page.tsx](src/app/(auth)/register/page.tsx)
- [src/app/page.tsx](src/app/page.tsx) — landing

### Feature components
- [src/components/features/groups/](src/components/features/groups) — `GroupCard`, `group-form`, `group-members-panel`, `group-detail-admin-actions`, `delete-group-button`, `invite-link-card`, `member-group-view`, `member-telegram-link`, `initialize-notify-button`, `contact-admin-form`
- [src/components/features/billing/](src/components/features/billing) — `payment-matrix`, `member-payment-list`, `payment-status-badge`, `no-periods-card`
- [src/components/features/dashboard/](src/components/features/dashboard) — `admin-services-table`, `all-groups-quick-status`, `notify-unpaid-button`
- [src/components/features/notifications/](src/components/features/notifications) — `collapsible-notifications-panel`, `notifications-hub-page-client`, `template-test-actions`
- [src/components/features/settings/](src/components/features/settings) — `settings-page-client`, `plugins-settings-tab`
- [src/components/features/activity/](src/components/features/activity) — `activity-email-preview`
- [src/components/features/profile/](src/components/features/profile) — email, password, prefs, telegram-link, unsubscribe
- [src/components/features/scheduled-tasks/](src/components/features/scheduled-tasks) — `scheduled-tasks-panel`

### Primitives
- [src/components/ui/](src/components/ui) — shadcn/ui (badge, button, card, sidebar, table, tabs, dialog, input/textarea/label, select, checkbox, avatar, tooltip, collapsible, sheet, dropdown-menu, …)

## Key entrypoints
1. [src/app/(dashboard)/dashboard/page.tsx:48](src/app/(dashboard)/dashboard/page.tsx:48) — dashboard home (4 stat cards + admin services + actions + group cards + workspace pulse)
2. [src/app/(dashboard)/dashboard/groups/[groupId]/page.tsx:151](src/app/(dashboard)/dashboard/groups/[groupId]/page.tsx:151) — group detail (admin / member conditional)
3. [src/app/(dashboard)/dashboard/payments/page.tsx:140](src/app/(dashboard)/dashboard/payments/page.tsx:140) — global payments table
4. [src/app/(dashboard)/dashboard/activity/page.tsx:303](src/app/(dashboard)/dashboard/activity/page.tsx:303) — activity feed
5. [src/components/layout/app-sidebar.tsx:83](src/components/layout/app-sidebar.tsx:83) — primary nav (groups list lives here)
6. [src/app/(dashboard)/layout.tsx:24](src/app/(dashboard)/layout.tsx:24) — auth guard + sidebar data fetch

## Module-specific conventions
- Server components by default; `'use client'` only where state/handlers are needed (mostly forms + sidebar).
- Pages fetch via `fetch()` with `cache: "no-store"`; consume the `{ data }` envelope.
- Route groups: `(dashboard)` (auth required), `(auth)` (login/register), `(public)` (landing + member portal).
- Theming via Tailwind CSS variables in `globals.css`; `ThemeToggle` in sidebar footer.
- Icons: lucide-react.

## Cross-cutting
- `auth()` redirects unauthenticated visitors out of `(dashboard)`.
- All client mutations follow the `{ data | error }` envelope.
- Sidebar groups list duplicates the `/dashboard` group cards and the `/dashboard/groups` grid (three places).

## Gotchas (simplification hotspots)
- **Three landing surfaces**: `/` (mostly empty hero), `/dashboard` (packed home), `/dashboard/groups` (full grid). Most users want "groups on home" — currently they have to scroll past stat cards / shortcuts / pulse cards to reach them.
- **Group cards appear in three places** (sidebar, dashboard home, groups page). Each renders slightly differently.
- **Group detail page is two UIs in one** — admin view (full) vs member view (`MemberGroupView`) selected by role; ~459-line file.
- **Confirm-payment surfaces**: 3 admin entry points (group detail matrix → inline button, payments table inline cells, members panel actions). Easy to lose track.
- **Scheduled-tasks page is sidebar-only** — no entry from group detail or payments page; admins miss it.
- **Activity feed has 13 filter combinations** + two tabs — high cognitive load.
- **Notification config split**: per-group toggles on group detail page; workspace-level config on `/dashboard/notifications`; some bits leak into `/dashboard/settings`. No single mental model.
- **Member experience bifurcation**: logged-in members see a limited group detail inside the dashboard shell; un-registered members see a standalone `/member/[token]` page. Same data, two designs.
- **Reminder workflow = 4 clicks** (dashboard → group → group detail → "Notify unpaid" or "Initialize"). Could be a one-click action on the group card.
- **No bulk confirm** — admin must confirm payments individually per period.

## Related modules
- `see-ref-groups` — group/member CRUD backs the UI
- `see-ref-billing` — billing matrix data
- `see-ref-notifications` — hub + activity feed
- `see-ref-auth` — middleware + session shape
- `see-ref-api-routes` — every page fetches from this surface

## Updating this ref
When the UI is restructured (e.g. groups-on-home), move the affected entries from "Gotchas" into "Module-specific conventions" with the new layout, and update key entrypoints.
