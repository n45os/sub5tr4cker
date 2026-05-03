---
name: author-clowalky-plan
description: Draft a fresh clowalky plan (STATUS.md + phase briefs) under .clowalky/_plans/<slug>/. Use when the user asks to "create a plan", "draft a clowalky plan", or "scaffold phases".
---

# author-clowalky-plan

Creates a new multi-phase plan under `.clowalky/_plans/<slug>/`. Read `.clowalky/AGENT.md` first for the format contract.

## Execution mode: draft and stop

- **No clarifying questions.** Derive the slug, the phase decomposition, and the brief contents from the user's prompt. If something is genuinely ambiguous, pick a defensible default and write a one-line note in the relevant brief; do not stop to ask.
- **No scheduling / follow-up offers.** Never pitch recurring agents, `/schedule` follow-ups, or "want me to start phase 0?" prompts. Author the plan and stop — execution is a separate step the user (or the orchestrator) triggers.
- **No status preambles.** Skip "Let me draft...", end-of-turn summaries, and adjacent-work suggestions. Print the slug and phase count when done. Nothing else.

## Procedure

1. Pick a short kebab-case `<slug>` from the user's intent. Refuse if a folder by that name already exists in `.clowalky/_plans/`.
2. Create the directory.
3. Write `STATUS.md` with the standard pipe-table header:
   ```
   | ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
   |----|-------|--------|------------|-------|---------|-----------|-------|
   ```
   Add one row per phase you're proposing, all `pending`. Leave `Started`, `Completed`, and `Notes` empty — the runner and `clowalky reconcile` fill those in.
4. Write one `phase-NN-<short-name>.md` per row. Use sections: `## Goal`, `## Scope`, `## Files to touch`, `## Acceptance criteria`, `## Manual verification`. Be concrete — name exact file paths.
5. Stop. Do **not** start executing any phase. The user (or clowalky) decides when to start.

## Sizing guidance

- 5–12 phases is typical. Fewer than 4 phases usually doesn't need a plan.
- Each phase should be independently testable.
- Phases that touch disjoint folders can run in parallel — note that in the `Notes` cell.

## Dependency hygiene (lint before you ship)

The runner picks the first eligible phase by walking the table. "Eligible" means `Status = pending` and every `Depends on` ID is `complete`. Briefs that **mention** another phase but don't **declare** it as a dep cause the orchestrator to pick a phase whose preconditions aren't actually built yet — exactly the kind of bug a cold autonomous run can't recover from.

Before you write the table, run this lint pass mentally on every brief:

- If phase B's brief references phase A by id (e.g. "the placeholder from phase 3", "after phase 1 lands", "wired in phase 4"), then **phase A must appear in phase B's `Depends on` cell**, even if B is technically self-contained.
- If two phases' "Files to touch" lists share a file, the one that owns the *structural* edit (deletes, renames, route additions) must be a dep of the one that just touches lines inside it.
- A phase that adds a screen route in `App.tsx` and a phase that wires the home key for that route are *not* parallel — declare a dep.
- Acceptance criteria that say "press X — Y screen opens" only hold if the home key has been rewired. If the rewire lives in a different phase, declare the dep.

When in doubt: declare more deps, not fewer. The orchestrator is good at running things in series; it is bad at recovering from a phase that ran out of order.

## "Files to touch" is the staging allowlist

When the runner advances a phase it stages by exact path — never `git add -A`. The brief's "Files to touch" section is the only allowlist the runner has. So:

- Enumerate every file the agent will reasonably need to change. If you forget one, the agent has to surface it in `Notes` and stop instead of silently expanding the commit.
- Do not list files the phase shouldn't touch — the runner treats the list as authoritative.
- `.clowalky/_plans/<slug>/STATUS.md` is staged automatically; you don't need to list it.

## Slug rules

- Use kebab-case (`my-feature`, not `MyFeature` or `my_feature`).
- Never start a slug with `__` — that prefix is reserved for archived plans.

## When to use a different skill

- Use `adopt-clowalky-plan` when you have an existing plan in some other format (markdown TODO, design doc, GitHub issue) to import.
- Use `run-next-clowalky-phase` to advance a phase, not to author one.

## Reference example

The clowalky repo itself uses this format. If you have access, look at `.clowalky/_plans/init-orchestrator/` (or any `__`-prefixed archived plan) for a complete worked example.
