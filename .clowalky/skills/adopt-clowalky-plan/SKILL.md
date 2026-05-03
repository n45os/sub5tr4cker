---
name: adopt-clowalky-plan
description: Convert an existing plan (markdown TODO, README section, pasted notes, GitHub issue, design doc, etc.) into a properly-shaped clowalky plan under .clowalky/_plans/<slug>/ with all rows pending. Use when the user asks to "adopt this plan", "import this plan", or "convert this into a clowalky plan".
---

# adopt-clowalky-plan

Takes a reference to an existing plan — a file path, URL, pasted text, or a heading inside a longer document — and converts it into a fresh `.clowalky/_plans/<slug>/` folder with `STATUS.md` and one `phase-NN-*.md` brief per phase, all rows `pending`. Read `.clowalky/AGENT.md` first for the format contract.

## Inputs you must extract from the prompt

- `source` — the plan reference: a file path, URL, pasted text block, or a heading + document combo. Required.
- `slug` — optional kebab-case override; otherwise derive one from the source's title.
- `projectRoot` — optional override; defaults to the current working directory.

If `source` is missing, abort with: `adopt-clowalky-plan: missing source`.

## Execution mode: convert and stop

- **No clarifying questions.** Read the source, decompose, and write the plan. If a section in the source is too vague to translate, write a `TBD — derive from <source-section>` placeholder rather than stopping to ask.
- **No scheduling / follow-up offers.** Never pitch recurring agents, `/schedule` follow-ups, or "want me to start phase 0?" prompts. Adopt the plan and stop — execution is a separate step the user (or the orchestrator) triggers.
- **No status preambles.** Skip "Let me read the source...", end-of-turn summaries, and adjacent-work suggestions. Print the slug and phase count when done. Nothing else.

## Procedure

1. Read the source plan in full. If it's a path, read the file; if a URL, fetch it; if pasted text, use the prompt verbatim; if a heading inside a doc, locate the heading and treat its subtree as the source.
2. Pick a kebab-case `slug`. Use the user-provided one if any; otherwise derive from the source title.
3. Refuse if `<projectRoot>/.clowalky/_plans/<slug>/` already exists. Do not merge. Surface: `adopt-clowalky-plan: plan <slug> already exists; pick a different slug or remove the existing folder`. Do **not** create the directory.
4. Refuse if the source contains in-progress / completed markers (✅, ☑, "DONE", "shipped", "complete", "[x]", check-marks, strikethrough). Surface: `adopt-clowalky-plan: source contains done/shipped markers; strip them or use author-clowalky-plan to draft fresh`. Do **not** create the directory.
5. Decompose the source into 5–12 phases. Re-use existing structure where possible: numbered lists, headings, "Step N" lines, sub-bullets. If the source is a flat description, propose a sensible breakdown.
6. For each phase assign: an `ID` (`0`, `1`, `2`, ... or `1a`, `1b` for siblings), a short `Phase` title, dependencies inferred from text cues ("after we ship X", "once Y is in place", "depends on"), and a brief filename `phase-NN-<short-name>.md`.
7. Create `<projectRoot>/.clowalky/_plans/<slug>/` and write `STATUS.md` using the standard pipe-table header from `.clowalky/AGENT.md`. One row per phase. `Status = pending` for every row. Leave `Started`, `Completed`, and `Notes` empty — the runner and `clowalky reconcile` fill those in.
8. Write each `phase-NN-<short-name>.md` with the standard sections (`## Goal`, `## Scope`, `## Files to touch`, `## Acceptance criteria`, `## Manual verification`). Where the source did not specify a section, write a one-line `TBD — derive from <source-section>` placeholder rather than inventing requirements.
9. Stop. Print the slug and the phase count. Do **not** start executing any phase.

## "Files to touch" is the staging allowlist

The runner stages each phase commit by exact path — never `git add -A`. The brief's "Files to touch" section is the only allowlist the runner has. When importing the source plan, translate vague references ("update the API layer", "fix the tests") into concrete file paths so the runner has something to stage. If the source is too vague to enumerate paths, leave a `TBD` placeholder and surface that in `Notes` rather than guessing.

## Hard rules

- Refuse and stop if the slug folder already exists (step 3). Never merge into an existing plan.
- Refuse and stop if the source has any done / shipped / completed markers (step 4). Do not silently strip them.
- Never use a slug that starts with `__` — that prefix is reserved for archived plans.
- Never start executing any phase. Authoring only.
- Never edit any file outside `<projectRoot>/.clowalky/_plans/<slug>/`.
- Never create the slug directory if step 3 or step 4 refused.

## When to use a different skill

- Use `author-clowalky-plan` when there is no source — drafting a plan from scratch out of a goal description.
- Use `run-next-clowalky-phase` when executing a phase that already exists, not creating one.
- Use the `clowalky reconcile` CLI when the source plan was already partially executed and you need to figure out which rows are real-complete vs drift before adopting.
