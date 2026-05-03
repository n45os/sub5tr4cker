# Phase 9a — Server-side smoke pass

> **Agent-runnable** counterpart to phase 9. Catches server-side regressions (5xx, build errors, missing routes, redirect chains) without needing an interactive browser. Phase 9 still owns the visual + click-budget walk; this phase is a tighter dep that fails fast if the server itself is broken.

## Goal

Boot `pnpm dev` against the redesigned dashboard, assert every important route returns the expected HTTP status, scan the dev server stderr for runtime exceptions, and produce a structured pass/fail record for phase 9 to read.

## Scope

In:
- `pnpm install` if `node_modules/` is stale.
- `pnpm typecheck` and `pnpm lint`. Treat new failures (vs. baseline `git stash` of phase 0) as fail.
- `pnpm dev` in the background; wait until it logs `Ready in` (or equivalent).
- For each route in the click-budget list (see "Routes" below), `curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n"` against `http://localhost:3000<path>` with a fake-session cookie if the route demands auth (skip auth-only routes if no test user is wired — note them as `skip-auth`).
- Tail `dev` stderr for any line matching `Error:|TypeError:|ReferenceError:|Module not found|Cannot find module`. Any hit = fail.
- Kill the dev server cleanly.
- Write `phase-09a-results.md` with: timestamp, route table (path / expected / observed / pass-fail), typecheck/lint/dev-stderr verdicts, and a one-line summary.

Out: visual / accessibility / interactive checks (those are phase 9). Production smoke (phase 9 does that too if the operator chooses).

## Files to touch

- `.clowalky/_plans/simplify-dashboard-ui/phase-09a-results.md` (new)
- `.clowalky/_plans/simplify-dashboard-ui/STATUS.md` (auto)

## Routes to probe

Translate the click budgets in `target-ui.md` to GET probes. At minimum:

- `/` → expect 307 → `/login` (or `/dashboard`, depending on session shape)
- `/login` → 200
- `/dashboard` → 307 → `/login` (no session) OR 200 (with session)
- `/dashboard/groups` → 307 → `/dashboard` (per phase 1's redirect)
- `/dashboard/billing` → 307 → `/dashboard/<groupId>` (per phase 4's redirect — note: requires a valid group id)
- `/dashboard/scheduled-tasks` → 200 (with session) / 307 → `/login` (without)
- `/dashboard/notifications` → same shape
- `/dashboard/payments` → same
- `/member/[token]` → 200 with a valid token; 4xx with an invalid one (skip if no fixture token)

Mark routes that demand auth as `skip-auth` if the project has no test fixture; phase 9 covers them with a real session.

## Acceptance criteria

- [ ] `pnpm typecheck` exits 0 (or matches the stashed-baseline failure list, if any).
- [ ] `pnpm lint` exits 0 (or matches baseline).
- [ ] Every probe row has `pass` (HTTP code matches expected, no 5xx).
- [ ] Dev stderr shows zero `Error:` / `TypeError:` / `ReferenceError:` / module-resolution lines during the probe window.
- [ ] `phase-09a-results.md` written.

## Manual verification

```
pnpm typecheck
pnpm lint
PORT=3000 pnpm dev > /tmp/sdu-dev.log 2>&1 &
DEV_PID=$!
# wait for readiness
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sS -o /dev/null http://localhost:3000/ && break
  sleep 1
done
# probe routes (sample)
for p in / /login /dashboard /dashboard/groups /dashboard/scheduled-tasks; do
  printf '%-40s ' "$p"; curl -sS -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000$p
done
grep -iE 'Error:|TypeError:|ReferenceError:|Module not found|Cannot find module' /tmp/sdu-dev.log | head
kill $DEV_PID
```

## Hard rules

- Don't write to the prod database. Localhost only.
- Don't commit `phase-09a-results.md` outside the plan dir.
- If `pnpm dev` fails to boot, dump the last 100 lines of stderr into `phase-09a-results.md` and mark the phase `blocked` with `report-clowalky-block` rather than guessing the cause.
