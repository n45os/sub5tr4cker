---
name: report-clowalky-block
description: Record a structured block report under .clowalky/_blocks/ when a phase cannot be completed. Use from inside run-next-clowalky-phase whenever the brief cannot be executed and you would otherwise just set Status = blocked. Also use when adopting/authoring discovers a phase that is unrunnable.
---

# report-clowalky-block

A worker agent calls this skill **instead of** quietly setting `Status = blocked` with a one-line reason. It writes a structured report the inspector can pick up and either auto-resolve or escalate.

## When to use

You're running `run-next-clowalky-phase` (or another autonomous run) and you cannot finish. The brief is unworkable, a precondition is missing, the working tree has WIP overlap, the CLI rejected the dispatch, etc.

If the cause is **transient** (network blip, a single failed test you can re-run) — just retry inside this run, do **not** call this skill.

If the cause **needs a decision** (ambiguous scope, missing file, wrong dependencies, the brief contradicts the code) — call this skill.

## Inputs you must extract from the calling prompt

- `plan-slug` — directory under `.clowalky/_plans/` (or `.clowalky/_clwky_dev_plans/`)
- `phase-id` — the value in the `ID` column of `STATUS.md`

If either is missing, abort with: `report-clowalky-block: missing plan-slug or phase-id`.

## Procedure

1. Locate the plan: try `<projectRoot>/.clowalky/_plans/<plan-slug>/` first, then `<projectRoot>/.clowalky/_clwky_dev_plans/<plan-slug>/`. If neither exists, abort with `report-clowalky-block: plan <slug> not found`.
2. Read `STATUS.md` and find the row whose `ID` cell matches `phase-id`. If not found, abort with `report-clowalky-block: phase <id> not in <slug>`.
3. Pick a category for the block. Use the shortest accurate one:
   - `missing-file` — a path the brief references doesn't exist
   - `brief-incorrect` — the brief contradicts what the code actually does
   - `ambiguous-scope` — the brief is vague enough that two reasonable agents would do different things
   - `dependency-not-complete` — `Depends on` claims X is done but X's effect is missing in the code
   - `wip-overlap` — files in "Files to touch" have uncommitted edits you can't separate from your own
   - `session-error` — the `claude` CLI rejected the dispatch (rotated session id, auth) and you cannot retry from here
   - `external-failure` — a build / test / network call failed in a way that needs human investigation
   - `other` — only when none of the above fits, and explain in the body
4. Decide `recoverable`: `true` if the inspector flipping `Status` back to `pending` (with no other change) would let the *next* run succeed. `false` if a human needs to edit the brief, the deps, or the code.
5. Write the report file at `<projectRoot>/.clowalky/_blocks/<plan-slug>__<phase-id>__<utc-timestamp>.md`:

```markdown
---
plan: <plan-slug>
phase: <phase-id>
title: <Phase cell value>
blockedAt: <ISO 8601 UTC, e.g. 2026-05-03T19:42:11.000Z>
category: <category from step 3>
recoverable: <true|false>
runId: <PlanRun id if you know it; else omit>
---

## What blocked

One paragraph. State the concrete observation, not "I think". Quote a filename, an error message, or a contradiction from the brief.

## What I tried

- Numbered or bulleted, ≤ 5 items.
- Each item is one sentence: action + outcome.

## What's needed to unblock

One paragraph. Be specific:
- "Edit phase-04-foo.md §Files to touch — add src/y.ts which the brief implies but doesn't list."
- "Rewire `Depends on` for phase 5 to include 3 (phase 5's brief assumes 3's refactor landed)."
- "User must commit/stash the WIP on src/x.tsx before this phase can run."

## Files touched (uncommitted, if any)

- path/relative/to/repo
- ...

(Empty list is fine — say "none" rather than dropping the section.)
```

6. Edit `STATUS.md`: change this row's `Status` to `blocked` and append `see _blocks/<filename>` to the `Notes` cell (preserve any existing notes — separate with `; `). Do not touch other rows.
7. Commit — **scoped staging only**:
   - Stage exactly two paths: the new `.clowalky/_blocks/<filename>` and `.clowalky/_plans/<plan-slug>/STATUS.md` (or `_clwky_dev_plans`, mirror what you read).
   - Subject exactly: `CLWLK: <plan-slug>/<phase-id> — block: <category>`. No body.
   - Never `git add -A`. Never include unrelated WIP.
8. Stop. Do not retry the phase. Do not edit any `phase-*.md` brief.

## Hard rules

- Exactly one report file per call. Never overwrite an existing report — the timestamp in the filename guarantees uniqueness.
- The report and the STATUS.md flip ship in the **same commit**. Splitting them creates drift.
- Never edit the `phase-*.md` brief. If you think the brief is wrong, that is the *content* of your report, not a fix.
- Never set `Status` back to `pending` from this skill. Only `fix-clowalky-block` (run by the inspector) does that.
- Never delete an existing block report. `fix-clowalky-block` archives them on resolution.

## When to use a different skill

- The brief is workable but you need to advance one phase: `run-next-clowalky-phase`.
- A user is reviewing blocks and wants to triage / unblock: `inspect-clowalky` (then `fix-clowalky-block`).
