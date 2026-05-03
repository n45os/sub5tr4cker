---
name: author-clowalky-plan
description: Draft a fresh clowalky plan (STATUS.md + phase briefs) under .clowalky/_plans/<slug>/. Use when the user asks to "create a plan", "draft a clowalky plan", or "scaffold phases".
---

# author-clowalky-plan

Drafts a fresh multi-phase plan under `.clowalky/_plans/<slug>/`. Read `.clowalky/AGENT.md` first for the format contract.

This is the highest-leverage authoring step in clowalky. **A plan is a unit of context**, not a unit of time or a list of features. Get the decomposition right and overnight runs land clean commits; get it wrong and every phase wastes its first thousands of tokens re-discovering the same files.

## How clowalky executes a plan (so you can author for it)

The orchestrator advances **one phase at a time**, sequentially per plan. For each phase it spawns a fresh `claude -p` with `cwd = <project>`, passes a tiny prompt that points at the brief, and waits for one commit. Then the next phase boots in a new session.

Implications you must design for:

- **No live memory carries between phases.** The agent that runs phase 2 does not "remember" what the phase 1 agent learned. It sees: `STATUS.md`, your brief, the repo on disk, and `.clowalky/AGENT.md`. That is all.
- **The prompt cache *does* carry across phases.** Every phase boots with the same surrounding instructions (AGENT.md, the run-next-phase skill, the runner's preamble). Identical-shape prompts across phases keep cache hits high — write all your briefs in the same shape.
- **The filesystem is the only durable inter-phase channel.** If phase 1 produces an insight phase 3 needs, it must live in the repo (a written doc, a refactor, a fixture, a comment) — not in a session.

So you are designing **one cohesive context that decomposes into commit-sized increments**. The "session continuity" between phases is fictional; the *cohesion* is real, and it's what you control.

## When to make ONE plan vs SEPARATE plans

Ask: would a reader of these briefs need to load roughly the same supporting code to follow each one?

- **One plan** — phases share files, vocabulary, and mental model. Example: "rewrite the auth middleware" → split across model, route layer, tests, docs. Every phase references the same files and the same domain language.
- **Separate plans** — initiatives touch disjoint subsystems even if the user asked for them in the same breath. Example: "fix the auth bug AND redesign the settings screen" → two plans. The auth-bug agent gains nothing from settings-screen context; bundling them dilutes the cache and bloats every brief.

Prefer two tight plans over one sprawling plan. The orchestrator runs different plans in parallel anyway (subject to `orchestratorMaxParallel`). One sprawling plan serializes work that didn't have to be serial.

If the user's goal naturally splits into two-or-more disjoint contexts, **say so and create multiple plans** under separate slugs. Do not force unrelated work into one plan to look tidy.

Heuristic check: write the *one-line summary of the plan goal* in your head. If the most natural summary needs an "and" between two unrelated subjects, split.

## Phase-0 as a context primer (the prefetched-context pattern)

For plans that need heavy upfront exploration (large refactors, plans against unfamiliar code, plans whose later phases all depend on shared invariants), dedicate **phase 0 to writing a context document** the rest of the plan reads.

Phase 0's brief says: *read these files, summarize the relevant invariants, gotchas, and shared types into `phase-00-context.md`, commit*. Every later phase declares `Depends on: 0` and **opens that document first**. They skip re-deriving because the answer is already in the repo, written down by an agent that had room to think.

This is the practical equivalent of "load the context once, fork it across phases" — the fork happens through the filesystem, not through session state. It costs one phase and pays back across every later phase by saving exploration tokens and protecting against later phases drawing different conclusions from the same code.

When phase-0 context primer is worth it:
- The plan touches >10 files or a subsystem the running agent likely hasn't seen
- Later phases all hinge on shared invariants (data shape, lifecycle ordering, naming convention) that need one canonical writeup
- A naive agent reading phase 3 in isolation would have to re-derive what phase 1 already discovered

When it is *not* worth it:
- Small plans (≤5 phases) where each brief is already self-contained
- Plans where every phase touches a totally different file set — that's a signal these are **separate plans**, not one plan with a primer
- Plans whose phases are mechanical / additive (e.g. "add the same field to 7 routes") — the brief itself is the primer

If you add a phase-0 primer, list `phase-00-context.md` in its "Files to touch", and reference that filename from later phase briefs ("See `phase-00-context.md` §<section>").

## Phase decomposition rules

- **Phases share vocabulary.** If you find yourself re-explaining a concept in phase 3 that you already defined in phase 1, you are probably authoring two plans.
- **One phase = one commit.** A "Files to touch" list spanning 25 files across 4 subsystems is two phases.
- **Each phase is independently testable.** "Acceptance criteria" must be checkable without depending on phases not in `Depends on`.
- **Disjoint folders → mark the phases parallel** in the `Notes` cell so the orchestrator (or a human reviewer) can see the dependency graph at a glance.

## Sizing guidance

- 5–12 phases is typical. Fewer than 4 phases usually doesn't need a plan — handle it inline.
- A plan whose STATUS.md doesn't fit on one screen is suspect — split it.

## Execution mode: draft and stop

- **No clarifying questions.** Derive the slug, the phase decomposition, and the brief contents from the user's prompt. If something is genuinely ambiguous, pick a defensible default and write a one-line note in the relevant brief; do not stop to ask.
- **No scheduling / follow-up offers.** Never pitch recurring agents, `/schedule` follow-ups, or "want me to start phase 0?" prompts. Author the plan and stop — execution is a separate step the user (or the orchestrator) triggers.
- **No status preambles.** Skip "Let me draft...", end-of-turn summaries, and adjacent-work suggestions. Print the slug(s) and phase count when done. Nothing else.

## Procedure

1. **Decide whether this is one plan or several.** Apply the "one-line summary needs an 'and'" check. If several, repeat steps 2–6 per slug and report all of them at the end.
2. **Decide whether the plan needs a phase-0 context primer.** Apply the criteria above. If yes, phase 0's deliverable is `phase-00-context.md`; subsequent phases declare `Depends on: 0` and reference back to that file.
3. **Pick a short kebab-case `<slug>`** from the user's intent. Refuse and stop if a folder by that name already exists in `.clowalky/_plans/`.
4. **Create the directory.**
5. **Write `STATUS.md`** with the standard pipe-table header:
   ```
   | ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
   |----|-------|--------|------------|-------|---------|-----------|-------|
   ```
   One row per phase, all `pending`. Leave `Started`, `Completed`, and `Notes` empty — the runner and `clowalky reconcile` fill those in.
6. **Write one `phase-NN-<short-name>.md` per row.** Use sections: `## Goal`, `## Scope`, `## Files to touch`, `## Acceptance criteria`, `## Manual verification`. Be concrete — name exact file paths.
7. **Stop.** Do **not** start executing any phase. The user (or clowalky) decides when.

## Dependency hygiene (lint before you ship)

The runner picks the first eligible phase by walking the table. "Eligible" means `Status = pending` and every `Depends on` ID is `complete`. Briefs that **mention** another phase but don't **declare** it as a dep cause the orchestrator to pick a phase whose preconditions aren't actually built yet — exactly the kind of bug a cold autonomous run can't recover from.

Before you write the table, run this lint pass mentally on every brief:

- If phase B's brief references phase A by id (e.g. "the placeholder from phase 3", "after phase 1 lands", "wired in phase 4"), then **phase A must appear in phase B's `Depends on` cell**, even if B is technically self-contained.
- If two phases' "Files to touch" lists share a file, the one that owns the *structural* edit (deletes, renames, route additions) must be a dep of the one that just touches lines inside it.
- A phase that adds a screen route in `App.tsx` and a phase that wires the home key for that route are *not* parallel — declare a dep.
- Acceptance criteria that say "press X — Y screen opens" only hold if the home key has been rewired. If the rewire lives in a different phase, declare the dep.
- If you used a phase-0 context primer, every later phase declares `Depends on: 0` (at minimum). Without that dep, the orchestrator can pick phase 5 before phase 0 has written the context file.

When in doubt: declare more deps, not fewer. The orchestrator is good at running things in series; it is bad at recovering from a phase that ran out of order.

## "Files to touch" is the staging allowlist

When the runner advances a phase it stages by exact path — never `git add -A`. The brief's "Files to touch" section is the only allowlist the runner has. So:

- Enumerate every file the agent will reasonably need to change. If you forget one, the agent has to surface it in `Notes` and stop instead of silently expanding the commit.
- Do not list files the phase shouldn't touch — the runner treats the list as authoritative.
- For phase-0 primers, list the `phase-00-context.md` file you want written.
- `.clowalky/_plans/<slug>/STATUS.md` is staged automatically; you don't need to list it.

## Slug rules

- Use kebab-case (`my-feature`, not `MyFeature` or `my_feature`).
- Never start a slug with `__` — that prefix is reserved for archived plans.

## When to use a different skill

- Use `adopt-clowalky-plan` when you have an existing plan in some other format (markdown TODO, design doc, GitHub issue) to import.
- Use `run-next-clowalky-phase` to advance a phase, not to author one.

## Reference example

The clowalky repo itself uses this format. If you have access, look at any `__`-prefixed archived plan under `.clowalky/_plans/` for a complete worked example.
