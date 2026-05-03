---
name: inspect-clowalky
description: Inspect clowalky orchestrator state, surface blocked plans / stuck PlanRuns / unresolved limit-hits, and propose remediations. Use when the user asks to "inspect clowalky", "see what's blocked", "audit my clowalky plans", or before triggering fix-clowalky-block.
---

# inspect-clowalky

Read-only audit pass over clowalky state. Produces a triage report. Does **not** mutate STATUS.md, plan-runs.json, or any block report — that's the job of `fix-clowalky-block`.

## When to use

- The user says "what's blocked?", "inspect clowalky", "audit my plans", "why is project X not progressing?"
- Before running `fix-clowalky-block` so you know which actions to feed it.
- After a long unattended overnight run, to surface anything that needs human input.

## Scope

You inspect three layers:

1. **Daemon layer** (`~/.clowalky/` JSON files + `daemon.log`).
2. **Per-project plan layer** (each registered project's `.clowalky/_plans/` and `.clowalky/_clwky_dev_plans/`).
3. **Block reports** (each project's `.clowalky/_blocks/` written by `report-clowalky-block`).

Default: inspect every `enabled: true` project in `~/.clowalky/projects.json`. If the user names a project (path or label), narrow to that one.

## Procedure

1. **Read daemon state.** Parse these files (all live under `~/.clowalky/` — honor `CLOWALKY_HOME` if set):
   - `config.json` — note `mode`, `orchestratorEnabled`, `queueDrainMode`, `devMode`.
   - `status.json` — note `limitReached`, `planFiveHourPercent`, `planFiveHourReset`.
   - `projects.json` — list of projects + `enabled`.
   - `plan-runs.json` — per-(project, plan) state. Look for `status` ∈ {`error`, `limited`, `blocked`} and stale `in-progress` (heuristic: `startedAt` more than 30 minutes ago with no completion).
   - `orchestrator-status.json` — current `running` and `paused`.
   - `queue.json` — manual queue (anything stuck behind a pause).

2. **Tail the daemon log.** Read the last ~500 lines of `~/.clowalky/daemon.log`. Filter to `orchfail`, `orchlimit`, `orchretry`, `orchsess`, `orchqdrop`, `orchqpause` — group by `<projectId>::<plan-slug>`.

3. **Walk each in-scope project.** For each one whose `enabled` is `true`:
   - Confirm `<projectRoot>` exists and contains `.clowalky/skills/run-next-clowalky-phase/SKILL.md` (init present). If missing, flag `init-missing` — the orchestrator will refuse to dispatch.
   - List active plan dirs: every entry under `.clowalky/_plans/` and `.clowalky/_clwky_dev_plans/` whose name does **not** start with `__`.
   - For each plan, parse `STATUS.md` and bucket rows by status.
   - For each plan, list `.clowalky/_blocks/*.md` files (if directory exists). Pair them to STATUS rows by `plan` + `phase` frontmatter.

4. **Cross-reference.** A row's status should agree with the block reports and plan-runs.json. Note any mismatch:
   - Row is `blocked` but no block report exists → `block-missing-report`.
   - Block report exists but row is not `blocked` (it was already unblocked or hand-edited) → `stale-block-report`.
   - PlanRun.status is `error` but no row in STATUS.md is `blocked`/`in-progress` → `planrun-error-no-row` (typically session-id rotation; auto-recoverable on next dispatch).
   - PlanRun.status is `limited` with `limitResetAt` in the past → `limit-stale` (will clear next tick).
   - Row is `in-progress` but `orchestrator-status.json` does not list it under `running` and `Started` is older than 30 min → `stuck-in-progress` (almost always a crashed/cancelled run).

5. **Produce a report.** Format exactly:

```
# clowalky inspect — <ISO timestamp>

## Daemon
- mode: <mode>
- orchestratorEnabled: <bool>
- queueDrainMode: <bool>
- 5h usage: <pct>%  reset: <reset>
- paused: <none | source/reason/until>

## <project label> (<projectId short>)
  path: <abs path>
  init: <ok | init-missing>

  ### <plan-slug>  (<active|debug>)
    rows: <pending=N in-progress=N complete=N blocked=N deferred=N>
    blockers:
      - phase <id>: <category> · recoverable=<bool>
        report: .clowalky/_blocks/<file>
        needed: <one-line summary from "What's needed to unblock">
    daemon notes:
      - <last 1–3 relevant orchfail/orchlimit/orchretry lines, with timestamps>
    crossref:
      - <any mismatch tag from step 4>

(repeat per plan, then per project)

## Triage summary
  auto-fixable (call fix-clowalky-block):
    - <projectLabel>/<plan>/<phase>  action=<unblock-and-retry|reset-planrun-error>  reason=<...>
  needs-human:
    - <projectLabel>/<plan>/<phase>  reason=<brief-incorrect|ambiguous-scope|wip-overlap|...>
```

6. **Stop.** Print the report. Do not call `fix-clowalky-block` automatically — wait for the user to confirm or to say "auto-fix the auto-fixable ones".

## Auto-fixability heuristics

A blocker is auto-fixable when:
- The block report's `recoverable` frontmatter is `true`, **and**
- The category is one of: `session-error`, `external-failure` (transient), `limit-stale`, `planrun-error-no-row`.

A `PlanRun.status = error` with `Error: Session ID ... is already in use` is auto-fixable: the runner now rotates session ids on its own, so just clearing the error state lets it retry. Action: `reset-planrun-error`.

A `limited` PlanRun whose `limitResetAt` is in the past is auto-fixable by clearing both fields. Action: `clear-limit`.

Everything else (`brief-incorrect`, `ambiguous-scope`, `dependency-not-complete`, `wip-overlap`, `stuck-in-progress` from a real crash) is **needs-human** — surface it but do not propose an automatic fix.

## What this skill does NOT do

- Edit `STATUS.md`. Read-only here.
- Edit `~/.clowalky/plan-runs.json`. Only `src/state.ts` (via `fix-clowalky-block`'s commands) is allowed to write that file.
- Move or archive block reports. `fix-clowalky-block` does that on resolution.
- Mutate the queue.

If you want to *act* on findings, hand the triage list to `fix-clowalky-block`.

## When to use a different skill

- Worker hit a block and needs to record it: `report-clowalky-block`.
- You already know what to fix: `fix-clowalky-block`.
- You are running a phase: `run-next-clowalky-phase`.
