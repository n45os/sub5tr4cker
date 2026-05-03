# Phase 9a — Server-side smoke results

- Run timestamp: 2026-05-03 (local)
- Baseline reference: commit `6e9722e` (`simplify-dashboard-ui/0`)
- Dev server probed: existing `pnpm dev` on http://localhost:3054 (advanced/Mongo mode). Could not start an isolated dev instance — `.next/dev/lock` is held by the running session and `NEXT_DIST_DIR` does not relocate the lock. Stderr scan therefore unverified (see "Limitations").
- Verdict: **FAIL** — 3 new TypeScript errors introduced by phase 3 in `src/components/features/groups/group-card-actions.tsx`.

## Typecheck (`pnpm exec tsc --noEmit`)

`.next/types/validator.ts` was deleted before running to clear stale type stubs from removed routes (`api/auth/[...nextauth]`, `api/register`).

| File | Line | Code | Message | Vs. baseline |
|------|------|------|---------|--------------|
| src/components/features/groups/group-card-actions.tsx | 118:28 | TS2322 | `delayDuration` not on `TooltipProvider` props | **NEW (phase 3)** |
| src/components/features/groups/group-card-actions.tsx | 120:31 | TS2322 | `asChild` not on `TooltipTrigger` props | **NEW (phase 3)** |
| src/components/features/groups/group-card-actions.tsx | 130:17 | TS2322 | `asChild` not on `Button` props | **NEW (phase 3)** |
| src/lib/authorization.test.ts | 70,71,127,128 | TS18048 | `payload.members` possibly undefined | baseline (file present at `6e9722e` with same shape) |
| src/lib/telegram/handlers.test.ts | 315,384,489 | TS2493 | empty-tuple index | from `telegram-admin-confirm-buttons/6` (out-of-plan, but post-baseline) |

Root cause for the new errors: `src/components/ui/tooltip.tsx` wraps `@base-ui/react/tooltip` (provider exposes `delay`, not `delayDuration`; `Trigger` has no `asChild`) and `src/components/ui/button.tsx` wraps `@base-ui/react/button` (no `asChild`). The phase-3 author wrote against the radix/shadcn API instead. Runtime consequence is that `delayDuration` / `asChild` get passed through as unknown props (no crash, but no behaviour either — tooltip will use default delay and the trigger/button will not render their children as the underlying element).

Verdict: **FAIL** — three new errors, all in files added by phase 3 of this plan.

## Lint (`pnpm lint`)

Total: **70 errors / 26 warnings, 96 problems**. Files with problems:

- src/app/(auth)/invite-callback/page.tsx
- src/app/api/auth/n450s/callback/route.ts
- src/app/api/groups/[groupId]/billing/[periodId]/route.ts
- src/app/api/groups/route.ts
- src/cli/commands/local/init.ts
- src/cli/commands/local/migrate.ts
- src/cli/commands/plugin.ts
- src/components/features/billing/payment-matrix.tsx (1 warning at 277:15 — `json` unused; same line/code in baseline `6e9722e`, **not** a regression)
- src/components/features/profile/notification-preferences-card.tsx
- src/components/theme-toggle.tsx
- src/lib/notifications/rebuild-email-from-params.ts
- src/lib/plugins/channels.ts
- src/lib/plugins/templates.ts
- src/lib/storage/sqlite-adapter.ts

Diff vs. baseline scoped to plan-touched paths (`src/app/dashboard/**`, `src/components/features/{groups,insights,sidebar,billing}/**`, `src/components/sidebar*`, `src/app/member/**`): **0 new lint problems**. All listed errors pre-date the plan and live in modules outside its scope.

Verdict: **PASS (matches baseline within scope)**.

## Route probes

Probed against `http://localhost:3054` (existing dev, advanced/Mongo mode). No session cookie attached.

| Path | Expected | Observed | Result |
|------|----------|----------|--------|
| `/` | 307 → `/login` | 307 → `/login?callbackUrl=%2F` | pass |
| `/login` | 200 | 200 | pass |
| `/dashboard` | 307 → `/login` (no session) | 307 → `/login?callbackUrl=%2Fdashboard` | pass |
| `/dashboard/groups` | 307 → `/dashboard` (phase 1 redirect) | 307 → `/login?callbackUrl=%2Fdashboard%2Fgroups` | skip-auth — middleware short-circuits to `/login` before the route's redirect runs; phase-1 redirect must be re-verified inside an authenticated session (phase 9 owns this) |
| `/dashboard/billing` | 307 → `/dashboard/<groupId>` (phase 4 redirect) | 307 → `/login?callbackUrl=%2Fdashboard%2Fbilling` | skip-auth — same reason; phase-4 redirect not directly observable without a session |
| `/dashboard/scheduled-tasks` | 307 → `/login` (no session) | 307 → `/login?callbackUrl=%2Fdashboard%2Fscheduled-tasks` | pass |
| `/dashboard/notifications` | 307 → `/login` (no session) | 307 → `/login?callbackUrl=%2Fdashboard%2Fnotifications` | pass |
| `/dashboard/payments` | 307 → `/login` (no session) | 307 → `/login?callbackUrl=%2Fdashboard%2Fpayments` | pass |
| `/member/invalid-token` | 4xx (or skip without fixture) | 200 | soft-pass — page renders an error UI rather than HTTP 4xx; intentional behaviour, not a 5xx regression. No fixture token available; phase 9 must verify a real-token render. |

No 5xx observed across any probe. Verdict: **PASS** for non-skip rows; two `skip-auth` rows deferred to phase 9.

## Dev stderr scan

**Could not perform.** The user's `pnpm dev` is already bound to port 3054, and `.next/dev/lock` blocks a parallel dev instance regardless of port or `NEXT_DIST_DIR`. Killing the user's dev to free the lock is out of scope for an autonomous run. Probes ran against the live dev, but its log is not under our control.

Verdict: **UNVERIFIED**. Phase 9 (interactive) can satisfy this criterion against a fresh dev session.

## Acceptance criteria

- [ ] `pnpm typecheck` exits 0 / matches baseline — **FAIL** (3 new errors in `group-card-actions.tsx`)
- [x] `pnpm lint` matches baseline within plan scope (0 new in-scope problems)
- [x] Every probe row has `pass` or documented `skip-auth`; no 5xx
- [ ] Dev stderr scan — **UNVERIFIED** (lock contention with user's dev session)
- [x] `phase-09a-results.md` written

## Recommended follow-up

1. New phase to fix the three `group-card-actions.tsx` errors: replace `<TooltipProvider delayDuration={150}>` with `<TooltipProvider delay={150}>`, drop `asChild` from `<TooltipTrigger>` and the receipt-link `<Button>` (or extend the local `ui/button` + `ui/tooltip` wrappers to support `asChild` against `@base-ui/react`).
2. Phase 9 (interactive) covers the `skip-auth` redirect targets and the dev-stderr scan.

## Limitations

- Stderr scan unverified (see above).
- Lint baseline comparison done by inspection of plan-scoped paths, not a full file-by-file diff against `6e9722e`. Pre-existing 70 errors / 26 warnings span modules out of plan scope and are not new.
- Authentication probes use no session cookie because no test fixture is wired (note made in brief). Authenticated probe coverage is phase 9's responsibility.
