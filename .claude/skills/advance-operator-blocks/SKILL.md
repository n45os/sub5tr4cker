---
name: advance-operator-blocks
description: Walk through clowalky phases that an autonomous worker marked blocked because it lacked operator access (VM SSH, Portainer UI, Hetzner console, browser smoke tests, push to remote), do the actual work with explicit per-action confirmation, then mark each row complete or split it into smaller phases the orchestrator can pick up. Use when the user says "solve the blocked clowalky phases", "I have access now, run through the blocked stuff", "advance the operator blocks", or after `inspect-clowalky` listed a needs-human queue.
---

# advance-operator-blocks

User-invoked **operator** skill. Where `run-next-clowalky-phase` is the autonomous worker, this skill is the **human-in-the-loop counterpart** for blocks that the worker correctly marked needs-human (because it had no SSH key / no browser / no MFA token / no push permission). You are the operator now; clowalky's bookkeeping is your responsibility.

This skill never runs autonomously. Every external side-effect (SSH, `docker exec`, `git push`, browser navigation, Portainer/Hetzner click) is confirmed with the user beforehand. If the user is not in the loop, abort with: `advance-operator-blocks: requires interactive user, refusing`.

## When to use

- User said "I have access now, run through the blocked stuff" / "solve the operator blocks" / "advance the needs-human queue".
- After `inspect-clowalky` produced a triage list and the user agreed to walk it.
- A specific named block: "advance n450s_website/security-wordpress-hardening/3, the VM changes are deployed".

## When NOT to use

- The block was genuinely transient (auto-fixable) — use `fix-clowalky-block` instead.
- The block is in a brief that's wrong / needs a human design call — leave it as needs-human and tell the user; do not try to power through.
- You are the autonomous runner (`run-next-clowalky-phase`). If the worker hits a wall, it calls `report-clowalky-block`, not this skill.

## Inputs you may extract from the prompt

- `projects` — optional list (project labels or paths). Default: every `enabled: true` project in `~/.clowalky/projects.json`.
- `only-categories` — optional filter, one or more of: `vm-ssh`, `portainer-ui`, `hetzner-console`, `browser-smoke`, `git-push`, `prod-db`, `prod-redeploy`, `other`.
- `dry-run` — if true, walk the queue but skip side-effects; useful to preview what would run.

If no triage list is provided in the prompt, run `inspect-clowalky` mentally first and use its output.

## Procedure

### 0. Establish operator mode

Print a one-line confirmation to the user before starting:

```
operator mode: advancing N blocked phases across <projects> · dry-run=<bool>
```

Wait for the user to confirm "go" / "yes" / "ok". If silence or anything else, stop. This is the **only** confirmation that authorizes the skill to start; per-action confirmations follow.

### 1. Triage the queue

Walk every project (or just the named ones) and list every phase whose STATUS.md row is `blocked`. For each, classify:

- `vm-ssh` — Notes mention SSH, `docker exec`, or a host IP / container name
- `portainer-ui` — Notes mention Portainer, GitOps, redeploy, image tag bump
- `hetzner-console` — Notes mention console.hetzner.cloud, MFA, firewall UI, DNS UI
- `browser-smoke` — Notes mention interactive login, Playwright, Puppeteer, screenshot, click-budget
- `git-push` — Notes mention push, "skill forbids push", submodule push, GitOps trigger requiring push
- `prod-db` — Notes mention mongosh, psql against prod, prod backup, prod write
- `prod-redeploy` — work is done in code/config but production hasn't been redeployed yet
- `other` — pick `other` and explain in one sentence

Apply `only-categories` if the user gave one.

Print the triage list grouped by category. Stop and ask: `proceed with all <N>? or pick a subset?`. Wait for the user to authorize the batch (or a subset).

### 2. For each block, in the order the user authorizes, run this loop

```
loop per block:
  a. Print: "<projectLabel>/<plan-slug>/<phase-id> — <phase-title>  category=<x>"
  b. Read the brief file in full.
  c. Read the existing STATUS.md row's Notes — it tells you exactly what was tried and what's needed.
  d. State the next action plainly. Examples:
       - "ssh root@135.181.153.99 'docker logs n450s-core-backend-1 --since 7d --tail 200'"
       - "git -C /Users/nassos/Developer/n450s_website/n450s_auth push origin main"
       - "open Hetzner Cloud console → Firewalls → create 'prod-allow-https-22'"
       - "in Portainer → Stacks → n450s_messenger → pull image → redeploy"
  e. Ask the user: "do this? (yes / skip / abort)"
       - yes: execute it. Capture exit code + a head/tail of output for the audit trail.
       - skip: leave the row blocked. Append "operator skipped <YYYY-MM-DD>" to Notes; commit only the Notes edit.
       - abort: stop the entire skill. Print a summary of what was advanced and what's left.
  f. Repeat (d) and (e) until the brief's "Acceptance criteria" hold.
  g. Decide the outcome:

      - All criteria met → MARK COMPLETE:
          - Edit STATUS.md row: Status → complete, Completed → today, append "operator-advanced <YYYY-MM-DD>" to Notes.
          - If verification produced an artifact (a doc, a paste, a screenshot path), save it under .clowalky/_plans/<plan-slug>/<filename> and add it to the commit.
          - Stage exactly: STATUS.md plus any artifact files. Never `git add -A`.
          - Commit subject: `CLWLK: <plan-slug>/<phase-id> — <phase-title>`. The runner uses this exact format and `clowalky reconcile` matches against it. (Optional body: a single line "operator-advanced via advance-operator-blocks". Skip the body if unsure — empty is fine.)
          - Print: "ok: <slug>/<id> complete"

      - Some criteria met, but the work uncovered new tractable subtasks → SPLIT INTO FOLLOW-UPS:
          - Add new phase rows to STATUS.md with Status=pending. ID them as "<original-id>a", "<original-id>b", etc., so they sort next to the parent row but never collide. Set the original row's "Depends on" to include all new subphase ids if the parent's verification still has to happen after.
          - Write one phase-NN-<short-name>.md brief per new row with the standard sections (Goal, Scope, Files to touch, Acceptance criteria, Manual verification).
          - Leave the parent row blocked OR flip it to pending if the parent's verification is now self-contained — your call, document in Notes.
          - Stage STATUS.md + the new brief files. Commit subject: `CLWLK: <plan-slug>/<phase-id> — split: <count> follow-ups`.
          - Print: "split: <slug>/<id> -> <new-ids>"

      - Work was partial and you do not want to leave the row in a half-done state → DEFER:
          - Edit row Status → deferred, Notes append "deferred by operator <YYYY-MM-DD>: <one-line reason>".
          - Stage STATUS.md only. Commit `CLWLK: <plan-slug>/<phase-id> — defer (operator)`.
          - Print: "deferred: <slug>/<id>"

      - Work confirmed the brief is wrong / impossible → KEEP BLOCKED, REWRITE BRIEF:
          - This is the only case where editing the phase-NN-*.md brief is allowed in this skill, and only when the user explicitly says "rewrite the brief".
          - Stage the brief edit + STATUS.md (Notes update only, Status stays blocked). Commit `CLWLK: <plan-slug>/<phase-id> — rewrite brief (operator)`.
          - Print: "rewrote brief: <slug>/<id>"
```

### 3. Final report

After the loop ends (either all done, or user said abort), print one block:

```
advance-operator-blocks summary
  completed:  <N>  → <slug>/<id>, ...
  split:      <N>  → <slug>/<id> (-> <new-ids>), ...
  deferred:   <N>
  skipped:    <N>
  remaining-blocked:  <N>  (these still need human action)
  pushes-pending:     <N>  (commits made locally, user must push to remote)
```

Do **not** push to a remote unless the user explicitly authorizes it for each push. Per the worker contract, push is a separate user-authorized step.

## Per-category playbooks

These are the canonical action templates. Adapt them to the brief — the brief is authoritative when it conflicts.

### vm-ssh

Default host inferred from the Notes (e.g., `root@135.181.153.99`). Confirm before every command. For multi-step work, batch-confirm the script as one block, then execute.

```
ssh -o BatchMode=yes -o ConnectTimeout=10 <user>@<host> '<single command>'
```

For `docker exec` against a container, prefer `-e` env vars over interactive shells; capture stdout+stderr.

### portainer-ui

You cannot click in Portainer from this skill. Two options:

1. Talk the user through the click-path. Print the steps and ask them to confirm each ("done? next?").
2. If Portainer's API is reachable and a token is available, prefer the API: `curl -H "X-API-Key: $PORTAINER_TOKEN" https://portainer.example/api/...`. Confirm with the user before each call.

Either way, the verification (e.g., `curl https://example.com/health` to confirm the redeploy landed) is what flips the row to complete.

### hetzner-console

Same shape as portainer-ui — talk the user through the console clicks; do not pretend to click yourself. Hetzner Cloud has an API and `hcloud` CLI; prefer those if a token is available.

### browser-smoke

If the project has Playwright or Puppeteer in deps, drive them. If not, walk the user through the manual click-path step by step:

```
"Open <url> in a browser, log in as <user>. Click X. Confirm Y is visible. Paste the screenshot path."
```

The artifact (screenshot, console-error log) goes into the plan dir as part of the completion commit.

### git-push

Submodule pushes are common ("skill forbids push", "submodule commits not pushed"). Walk the user through:

```
git -C <submodule-path> log --oneline @{u}..HEAD     # show what's about to go up
git -C <submodule-path> push origin <branch>
```

Confirm each push individually. After every push, re-check whether downstream blocks (e.g., "awaiting GitOps redeploy") have cleared, and resume those.

### prod-db

Prefer read-only sessions (`mongosh --readPreference secondaryPreferred`, `psql` with `SET TRANSACTION READ ONLY`). Take a backup before any write. Confirm every query.

### prod-redeploy

The work was done in a previous phase but production hasn't picked it up. Either trigger the redeploy (Portainer / GitOps webhook / CI re-run) or wait. If the user can wait, mark the row pending with a `runAfter` note so the orchestrator retries later; otherwise drive the redeploy.

## Hard rules

- **Confirm every external action.** SSH, push, deploy, prod-db query — all confirmed individually. Batch confirmations for clearly-scoped scripts are OK, but no batch covers cross-host work.
- **Never `git add -A`.** Stage by exact path. `STATUS.md` plus the artifact files plus (for splits) the new brief files. That is it.
- **Never edit a `phase-*.md` brief** unless the user explicitly told you to rewrite it (and only as the "rewrite brief" outcome).
- **Never push** unless the user explicitly authorizes that specific push.
- **Never `git commit --amend`.** Always create new commits. The reconcile step relies on subject matching; amending breaks it.
- **Never edit `~/.clowalky/plan-runs.json` by hand.** If the daemon-level state is wrong, surface to the user and let them either run `fix-clowalky-block` (when a CLI exists) or restart the daemon.
- **Use `CLWLK:` commit subjects.** This is what `clowalky reconcile` expects. `clowalky:` is a legacy fallback only.
- **Stop on first abort.** If the user says abort, print the summary and stop. Do not "finish the current loop iteration" — abort is immediate.

## When to use a different skill

- Worker hit a block mid-phase: `report-clowalky-block`.
- Surveying state: `inspect-clowalky`.
- Flipping STATUS without doing the underlying work (e.g., the work was already done in a previous out-of-band commit): `fix-clowalky-block mark-complete`.
- Drafting a new plan from scratch: `author-clowalky-plan`.
