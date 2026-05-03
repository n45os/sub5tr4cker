# Target UI — simplification spec

This document is the contract every other phase in `simplify-dashboard-ui` references. Each phase brief must be able to quote a specific bullet from this file as its justification. If you find yourself wanting to do something not described here, stop and amend this file first.

Audit baseline (today, 2026-05-03): see "Gotchas" in `.claude/skills/see-ref-ui/SKILL.md`. Confirmed by reading `src/app/(dashboard)/dashboard/page.tsx` and the route map for `/dashboard`, `/dashboard/groups`, `/dashboard/groups/[id]`, `/dashboard/payments`, `/dashboard/activity`, `/dashboard/notifications`, `/dashboard/scheduled-tasks`, `/dashboard/settings`, `/member/[token]`.

---

## 1. Routes after simplification

### `/` (landing — public)
Unchanged hero + CTA to login/register. Out of scope for this plan.

### `/dashboard` (admin home — was a packed mixed page; becomes the groups grid)
- Page chrome: header strip with workspace name, "+ New group" button, and a single collapsed `Insights` strip.
- Body: groups grid (the same grid that lives at `/dashboard/groups` today). One column on mobile, auto-fill ≥260px cards on desktop.
- Each group card surfaces: service icon + name, member count, current price + cycle, next billing date, unpaid count, and **two inline quick actions**: `Notify unpaid` (one-click; uses the existing aggregated-reminder path) and `View billing`.
- The collapsed `Insights` strip (closed by default, remembers last state in localStorage) reveals: total groups, members tracked, pending confirmations, tracked spend, groups needing attention, healthy groups. Same numbers as today's stat-card row + workspace-pulse cards, just behind a disclosure.
- No "Common admin actions" card. No "Hidden no more" card. No standalone `AllGroupsQuickStatus` block. Those surfaces are deleted (see §3).

### `/dashboard/groups` (deprecated route — redirects to `/dashboard`)
Legacy URL only. 308-redirect to `/dashboard` so external bookmarks / sidebar links still resolve. The grid no longer renders here.

### `/dashboard/groups/new`
Unchanged. Group creation form.

### `/dashboard/groups/[groupId]` (group detail — consolidated, single-scroll)
One page, in this vertical order:
1. **Header**: service icon, name, role badge, edit / delete affordances (admin only).
2. **At-a-glance**: current period status, next billing date, unpaid count, totals.
3. **Billing matrix** (the existing `payment-matrix`, six periods preview). Admins get a `Bulk-confirm…` action at the top of the matrix (see §click budgets). Each row still has the per-cell confirm.
4. **Members** (the existing `group-members-panel`). Inline.
5. **Actions** (admin): `Notify unpaid`, `Initialize billing` (when not yet initialized), `Open notifications hub`, `Open delivery log` filtered to this group.
6. **Member view** (when role !== admin) renders the *same* component as `/member/[token]` (see next bullet) instead of the current `MemberGroupView`.

### `/dashboard/groups/[groupId]/edit`, `…/billing`
Edit page unchanged. The dedicated `…/billing` page is **kept but de-emphasized** — no nav links into it anymore; the detail-page matrix is the canonical surface. The standalone billing page remains as a deep-link target only.

### `/dashboard/payments`
Unchanged in this plan. Inline confirm in cells stays.

### `/dashboard/activity`
- Default filter: `channel = all`, `source = sent notifications`, last 30 days. The current 13-combination filter chip row collapses behind a single `Filters` disclosure that opens to the existing controls.
- Tabs unchanged.

### `/dashboard/notifications`, `/dashboard/scheduled-tasks`, `/dashboard/settings`, `/dashboard/profile`
Unchanged. Reachable from the slim sidebar (see next route).

### Sidebar (every `/dashboard/*` route)
- Primary nav: `Home` (→ `/dashboard`), `Payments`, `Activity`.
- Per-group list section (existing) — but de-duped: when on `/dashboard` it does not also render the cards (the body owns that). Sidebar only shows the names + unpaid badge.
- Collapsible **More** group containing: `Notifications`, `Scheduled sends`, `Settings`, `Profile`. Closed by default; remembers state.

### `/member/[token]` (public member portal — canonical member surface)
Unchanged in shape. This becomes the *single* component used for both guest token visitors and logged-in non-admin members on `/dashboard/groups/[groupId]`.

### `/login`, `/register`
Unchanged.

---

## 2. Click budgets

Counted from the user's current location to the action being completed. "Click" = mouse click or equivalent tap.

- **See all my groups**: 0 clicks from `/dashboard` (it *is* the groups grid).
- **Open one group's detail**: 1 click from `/dashboard` (group card → detail).
- **Send reminder to unpaid members of a group**: 1 click from `/dashboard` (`Notify unpaid` on the group card). Down from 4 today.
- **Confirm a single member's payment**: 2 clicks from `/dashboard` (group card → confirm cell in matrix).
- **Bulk-confirm everyone for the current period of one group**: 2 clicks from `/dashboard` (group card → `Bulk-confirm…` in matrix → modal confirm = 3rd is the modal). Net: 3 including the confirmation dialog. New capability.
- **See recent sent notifications**: 1 click from `/dashboard` (sidebar → Activity; default filters land on "sent, all channels, 30 days").
- **Open notifications hub** (channel/template config): 2 clicks from `/dashboard` (sidebar → More → Notifications).
- **Open scheduled-tasks queue**: 2 clicks from `/dashboard` (sidebar → More → Scheduled sends).
- **Change workspace settings**: 2 clicks from `/dashboard` (sidebar → More → Settings).
- **Member checks own payment status**: 0 clicks beyond opening their portal URL (`/member/[token]` or `/dashboard/groups/[groupId]` for logged-in members — both render the same view).

---

## 3. What we delete or hide

Named so phases don't accidentally leave anything behind.

- `src/app/(dashboard)/dashboard/page.tsx` — the four stat cards (`Total groups`, `Members tracked`, `Pending confirmations`, the hero card), the `Common admin actions` card, the `Hidden no more` card, the `AllGroupsQuickStatus` section, and the `Workspace pulse` card. All of this either moves into the collapsed Insights strip (numbers only) or is deleted (the navigation cards — sidebar already covers them).
- `AdminServicesTable` (`src/components/features/dashboard/admin-services-table.tsx`) — superseded by the groups grid + per-card quick actions. Delete.
- `AllGroupsQuickStatus` (`src/components/features/dashboard/all-groups-quick-status.tsx`) — superseded by the per-card unpaid badge + Insights strip. Delete.
- `MemberGroupView` (`src/components/features/groups/member-group-view.tsx`) — replaced by the `/member/[token]` component reused inside the dashboard shell. Delete after phase 5.
- `/dashboard/groups` page body — replaced with a 308 redirect to `/dashboard`.
- The standalone "stat row + shortcut grid" pattern on the dashboard home — gone. The Insights strip is the only place workspace-level numbers live on the home route.
- Sidebar duplication of group cards — sidebar shows names + badges only; the grid is the body's job on `/dashboard`.

---

## 4. What stays unchanged

Explicit so phases don't drift.

- All API routes, data models, jobs, and the storage adapter. This plan is UI-only.
- Auth flows, middleware, session shape.
- `/login`, `/register`, `/`, `/member/[token]` (the latter is *adopted* as canonical, but not modified beyond what phase 5 needs to make it embeddable).
- `/dashboard/groups/new`, `/dashboard/groups/[groupId]/edit`, `/dashboard/groups/[groupId]/billing` — kept as-is (the billing route just loses navigation entries).
- `/dashboard/payments`, `/dashboard/notifications`, `/dashboard/scheduled-tasks`, `/dashboard/settings`, `/dashboard/profile` — bodies unchanged in this plan.
- The `payment-matrix` component itself — the bulk-confirm action is added as a sibling control in phase 6, not by rewriting the matrix.
- Theming, shadcn primitives, lucide icons, the app shell skeleton (`SidebarProvider` + `AppSidebar` + `AppHeader`).
- Cron, notifications dispatch, telegram polling/webhook, billing calculations, HMAC token handling — every non-UI subsystem.

---

## Phase → spec line mapping

For sanity, here is which line each downstream phase will quote:

- Phase 1 (groups as home) → §1 `/dashboard` bullet + §3 deletion list for the home page.
- Phase 2 (insights strip) → §1 `/dashboard` "collapsed Insights strip" bullet + §3 stat-row deletion.
- Phase 3 (group card quick actions) → §1 group-card "two inline quick actions" bullet + §2 "Send reminder = 1 click".
- Phase 4 (group detail consolidation) → §1 `/dashboard/groups/[groupId]` ordered list (1–6).
- Phase 5 (unify member portal) → §1 group detail bullet 6 + §3 `MemberGroupView` deletion.
- Phase 6 (bulk-confirm) → §1 billing matrix bullet 3 + §2 "Bulk-confirm" budget.
- Phase 7 (sidebar slim-down) → §1 Sidebar bullets + §3 sidebar duplication entry.
- Phase 8 (activity default-filter cleanup) → §1 `/dashboard/activity` bullets.
- Phase 9 (smoke) → §2 (every click budget is a test case).
