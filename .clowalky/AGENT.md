# .clowalky/AGENT.md

You are an agent working inside a project that uses **clowalky** to drive multi-phase implementation plans. This file is the contract.

## Where plans live

```
.clowalky/_plans/<plan-slug>/        ← active plan
.clowalky/_plans/__<plan-slug>/      ← archived plan (every row complete or deferred)
.clowalky/_clwky_dev_plans/<slug>/   ← auto-generated debug plans (drift fixes); dev-mode only
```

Each plan directory contains:

```
STATUS.md            ← single source of truth for phase scheduling
phase-00-*.md        ← one file per phase, the brief for that phase
phase-01-*.md
...
```

## STATUS.md format

A markdown pipe-table with these columns, in this order:

```
| ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
```

- **Status** is exactly one of: `pending` · `in-progress` · `complete` · `deferred` · `blocked`.
- **Depends on** is a comma-separated list of phase IDs, or `—` / empty.
- **Brief** is the filename of the per-phase markdown.
- **Started / Completed** are `YYYY-MM-DD`.
- **Notes** is free-form, but `clowalky reconcile` appends a `commit=<short-sha>` token here once it has matched a completed row to its `CLWLK:`-prefixed commit. Do not strip those tokens.

A phase is **eligible** when its status is `pending` AND every ID in its `Depends on` cell has status `complete`.

## Per-phase brief format

Each `phase-NN-*.md` should contain at minimum:

- `## Goal` — one paragraph
- `## Scope` — what's in
- `## Files to touch` — bullet list (this is the staging allowlist for the phase commit)
- `## Acceptance criteria` — checklist
- `## Manual verification` — exact commands to run

## Execution mode: just run, do not converse

You are running unattended — typically dispatched by the clowalky daemon while no human is at the keyboard. Treat every phase run as autonomous.

- **No clarifying questions.** The brief plus STATUS.md is the full contract. If a detail is unspecified, pick the most reasonable interpretation and document it in `Notes`.
- **No scheduling / follow-up offers.** Never propose recurring agents, cron jobs, `/schedule` follow-ups, or "want me to do X next?" prompts.
- **No suggestions for adjacent work.** Refactors, cleanups, unrelated improvements — drop them or surface in `Notes` if load-bearing; never pitch them as next steps.
- **No status preambles or summaries.** Execute the brief and stop. The git commit is your report.
- **Block, don't escalate.** If you genuinely cannot proceed, call the `report-clowalky-block` skill — it writes a structured report under `.clowalky/_blocks/` and flips the row to `Status = blocked` in a single commit. Do not ask the user to choose between options. (The legacy fallback — set `Status = blocked` with a one-line `Notes` reason and don't commit — is still tolerated, but `report-clowalky-block` is preferred because the inspector can act on it.)

## Rules for advancing a plan

1. Pick the **single phase you were asked to advance** (clowalky tells you which). Do not work on others.
2. Verify it is eligible (pending + dependencies complete). If not, abort with a one-line note.
3. Set the row to `in-progress` and write today's date in `Started` **before** doing any work.
4. Read the brief in full and execute it. Stay inside the listed scope and "Files to touch".
5. Set the row to `complete` with today's date in `Completed`. (`clowalky reconcile` will fill in the commit hash later.)
6. Commit — **scoped staging only**:
   - Stage only the files you modified, by exact path: `git add <path1> <path2> ... .clowalky/_plans/<plan-slug>/STATUS.md`. Always include the updated STATUS.md.
   - **Never** use `git add -A` or `git add .`. Other working-tree changes are not yours to commit.
   - Subject exactly: `CLWLK: <plan-slug>/<phase-id> — <phase-title>`. No body, no co-author lines, no trailing punctuation. (`clowalky:` is accepted as a legacy fallback but `CLWLK:` is the current convention.)
7. If you cannot finish, call `report-clowalky-block` (see `.clowalky/skills/report-clowalky-block/SKILL.md`). It writes a structured block report and flips the row to `blocked` in one commit. The inspector (`inspect-clowalky` + `fix-clowalky-block`) picks up from there.
8. After step 6 succeeds, check whether every row in STATUS.md is now `complete` or `deferred`. If so, the plan is done — archive it:
   - `git mv .clowalky/_plans/<plan-slug> .clowalky/_plans/__<plan-slug>`
   - Commit with subject: `CLWLK: <plan-slug> — plan archived`. Nothing else in this commit.
9. Never edit another row, another plan, or any `phase-*.md` brief.
10. Never invent new phases — that's the human's job.

## What you must never do

- Push, branch, force-push, or amend.
- Touch `projects.local.json` (reserved).
- Use `git add -A` or `git add .` in a phase commit.
- Create a sample plan or rename existing plans (the only legal rename is the archive rename in step 8).

## Skills available in this project

Runtime (orchestrator-invoked, autonomous):

- `run-next-clowalky-phase` — advance one phase. The dispatcher's primary call.
- `report-clowalky-block` — record a structured block report under `.clowalky/_blocks/` and flip the row to `blocked` in one commit. Call this from inside `run-next-clowalky-phase` when you cannot proceed.

Triage (user-invoked, after a run):

- `inspect-clowalky` — read-only audit across daemon state, plans, and block reports. Produces a triage report.
- `fix-clowalky-block` — apply one targeted fix (`unblock-and-retry`, `defer`, `mark-complete`, `clear-stuck-in-progress`, …). One action per call.

Operator (user-invoked, human-in-the-loop):

- `advance-operator-blocks` — walk the needs-human queue (VM SSH, Portainer, browser smoke, push-to-remote), do the underlying work with per-action confirmation, then mark each row complete or split it into smaller phases. The counterpart to `run-next-clowalky-phase` for blocks the autonomous worker correctly refused.

Authoring (user-invoked, before a run):

- `author-clowalky-plan` — draft a fresh plan from scratch when there is no source.
- `adopt-clowalky-plan` — convert an existing plan (markdown TODO, README section,
  pasted notes, GitHub issue, etc.) into a properly-shaped clowalky plan whose
  rows are all `pending`. Refuses if the source has any "done" markers.

## Dev mode and reconciliation

Clowalky currently runs in **dev mode** (`devMode: true` in `~/.clowalky/config.json`; the only mode for now). Dev mode means STATUS.md is treated as the durable record and is reconciled against git history on demand.

`clowalky reconcile` (the user runs it) walks every active plan in every registered project and:

1. For each row whose `Status` is `complete` but whose `Notes` lacks a `commit=<sha>` token, finds the matching `CLWLK: <plan-slug>/<phase-id>`-prefixed commit (with `clowalky:` accepted as a legacy fallback) and appends `commit=<short-sha>` to the `Notes` cell.
2. For each row whose `Status` is `complete` but for which **no** matching commit exists in git history, treats this as drift. In dev mode it auto-generates a debug plan under `.clowalky/_clwky_dev_plans/<plan-slug>-drift/` describing the discrepancy so the next phase run can investigate and fix it.
3. For any plan whose every row is `complete` / `deferred` but whose folder is not yet `__`-prefixed, prints a reminder so the user (or a follow-up agent) can archive it.

`_clwky_dev_plans/` mirrors the shape of `_plans/` and is also scanned by the orchestrator. Once you've fixed a drift, archive the debug plan with the same `__` rename rule.
