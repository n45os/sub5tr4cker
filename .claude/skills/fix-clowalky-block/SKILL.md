---
name: fix-clowalky-block
description: Apply a targeted, minimal mutation to unblock a clowalky phase or plan-run after inspect-clowalky has triaged it. Use when the user says "unblock plan X phase Y", "auto-fix the recoverable ones", or "clear the stale limit on plan Z".
---

# fix-clowalky-block

Single-purpose mutator. `inspect-clowalky` decides *what* to fix; this skill is *how* to fix it. Each invocation performs **one** action against one plan/phase/plan-run, commits the change, and stops.

## Inputs you must extract from the calling prompt

- `projectRoot` — absolute path. Required.
- `plan-slug` — required for actions that touch a plan.
- `phase-id` — required for actions that touch a row.
- `action` — exactly one of:
  - `unblock-and-retry` — flip a `blocked` row back to `pending` and archive the matching block report. Use when the report is `recoverable: true`.
  - `defer` — flip a `blocked` row to `deferred`. Use when the brief is unworkable and not worth doing.
  - `mark-complete` — flip a `blocked` (or `in-progress`) row to `complete`. Use **only** when verification proves the work is already on `HEAD`. Requires `commit-sha` input.
  - `clear-stuck-in-progress` — flip an `in-progress` row back to `pending`. Use when a previous runner crashed and `orchestrator-status.json` does not list it as `running`.
  - `reset-planrun-error` — clear `PlanRun.status = error` + `PlanRun.lastError` so the orchestrator picks the plan up again. STATUS.md is not touched.
  - `clear-limit` — clear `PlanRun.limitReached` / `limitResetAt` / `limitDetectedAt` when the reset time is in the past. STATUS.md is not touched.

If `action` is missing or not in the list above, abort with: `fix-clowalky-block: invalid action <value>`.

## Execution mode: just act, do not converse

- **No clarifying questions.** Inspector decides; you execute.
- **One action per invocation.** Multiple plans → multiple invocations.
- **No status preambles.** Print "ok: <action> <slug>/<phase>" and stop. Or "abort: <reason>".

## Procedure (per action)

### unblock-and-retry

1. Locate plan dir under `_plans/` then `_clwky_dev_plans/`. Abort if missing.
2. Read `STATUS.md`, find the row by `phase-id`. Abort if `Status` is not `blocked`.
3. Find the most recent block report at `.clowalky/_blocks/<plan-slug>__<phase-id>__*.md`. If multiple, pick the newest by filename. If none, surface a warning but still proceed (some blocks predate the report skill).
4. Move the report: `git mv .clowalky/_blocks/<file> .clowalky/_blocks/__archived/<file>`. Create the `__archived/` directory if needed.
5. Edit `STATUS.md`:
   - `Status`: `blocked` → `pending`
   - `Started`, `Completed`: clear (the next runner sets `Started`).
   - `Notes`: strip any `see _blocks/<...>` token; preserve other notes; append `unblocked <YYYY-MM-DD>`.
6. Stage exactly: the moved-from path, the moved-to path, and `STATUS.md`. Never `git add -A`.
7. Commit: `CLWLK: <plan-slug>/<phase-id> — unblock: retry`.

### defer

1–2. As above, but assert `Status` is currently `blocked`.
3. Edit `STATUS.md`: `Status` → `deferred`. Append `deferred <YYYY-MM-DD>` to `Notes`. Leave `Started`/`Completed` as they are.
4. Leave the block report in place — it documents *why* this was deferred.
5. Stage exactly `STATUS.md`. Commit: `CLWLK: <plan-slug>/<phase-id> — defer`.

### mark-complete

1. Read STATUS.md, locate the row.
2. Verify the user supplied a `commit-sha` and that `git cat-file -e <sha>` succeeds. If not, abort.
3. Edit row: `Status` → `complete`, `Completed` → today, append `commit=<short-sha>; reconciled-by-fix-block <YYYY-MM-DD>` to `Notes`.
4. If a block report exists, archive it as in `unblock-and-retry`.
5. Stage `STATUS.md` (+ the moved block report if any). Commit: `CLWLK: <plan-slug>/<phase-id> — reconcile: mark-complete <short-sha>`.

### clear-stuck-in-progress

1. Read STATUS.md, locate row.
2. Assert `Status` is `in-progress` AND `<projectId>::<plan-slug>` is **not** in `~/.clowalky/orchestrator-status.json`'s `running`. If a runner is genuinely live, abort: `fix-clowalky-block: <slug>/<phase> is currently running, refuse`.
3. Edit row: `Status` → `pending`, clear `Started`, append `recovered-from-crash <YYYY-MM-DD>` to `Notes`.
4. Stage `STATUS.md`. Commit: `CLWLK: <plan-slug>/<phase-id> — recover: stuck-in-progress`.

### reset-planrun-error

This action mutates `~/.clowalky/plan-runs.json` — a state file owned by `src/state.ts`. **Do not edit it by hand.** Two acceptable paths:

a. **Preferred — call the CLI** (when one exists). At time of writing the codebase exposes mutation only via the daemon and the runner; if a future `clowalky fix` subcommand exists, use it: `clowalky fix reset-planrun-error <projectId> <plan-slug>`.
b. **Fallback — instruct the user.** If no CLI is available yet, do **not** edit `plan-runs.json` directly. Print: `fix-clowalky-block: reset-planrun-error needs a CLI; please run "clowalky fix reset-planrun-error <projectId> <plan-slug>" or stop the daemon, edit the run row's status to "idle" and clear lastError, then restart`. Stop.

The daemon will pick up the run on its next scan and dispatch it again. The runner already auto-rotates session ids on `Session ID ... is already in use`, so the most common cause clears itself.

### clear-limit

Same constraints as `reset-planrun-error` — write to `plan-runs.json` only via official channels. If no CLI exists, instruct: stop daemon, edit the row to clear `limitReached`/`limitResetAt`/`limitDetectedAt`, restart. Or wait for the next `limitResetAt` to elapse — the scheduler auto-clears expired limits on its own poll.

## Hard rules

- One action per invocation. No batching.
- Never `git add -A`. Stage by exact path, always.
- Never edit any `phase-*.md` brief. The brief is the human's contract.
- Never edit a STATUS.md row that does not match `phase-id`.
- Never edit `~/.clowalky/plan-runs.json` by hand outside the official channels (`src/state.ts` helpers or a future `clowalky fix` CLI). Surface the action to the user instead.
- Never delete a block report. Move to `.clowalky/_blocks/__archived/` so the audit trail survives.
- Never push, branch, force-push, or amend.
- Never run a phase. `run-next-clowalky-phase` does that; this skill only adjusts state so the next dispatch can succeed.

## When to use a different skill

- Walking the whole landscape: `inspect-clowalky`.
- Worker recording a fresh block: `report-clowalky-block`.
- Executing a phase: `run-next-clowalky-phase`.
