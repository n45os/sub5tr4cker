---
name: release-docs-sync
description: Syncs technical and user documentation after a version bump. Use after updating package.json and CHANGELOG.md with a new release, or when the user says "sync docs", "update docs for release", "we shipped 0.x.y". Triggers on "release docs", "sync documentation", "shipped version", "post-release".
---

# Release Docs Sync

Run this skill immediately after a version bump (patch, minor, or major) has been committed to `package.json` and a new dated section has been added to `CHANGELOG.md`.

## Semver in this project (`0.y.z`)

| Digit | Example | Scope of doc updates |
|-------|---------|----------------------|
| **Patch** (`z`) | `0.24.0` → `0.24.1` | Narrow fixes — correct wrong lines in API ref, env table, FAQ |
| **Minor** (`y`) | `0.24.*` → `0.25.0` | New endpoints, models, settings, flows — expect broader doc edits |
| **Major** | → `1.0.0` | Breaking changes — review every doc file for outdated assumptions |

## Workflow

### 1. Read the new CHANGELOG section

Open the **topmost** `## [x.y.z]` block in `CHANGELOG.md`. List the user-facing deltas:

- new or changed API endpoints
- new or changed data model fields
- new or changed env vars or settings
- cron / deployment / operational changes
- UI flow changes visible to users or admins

### 2. Patch releases — targeted edits only

For a **patch** bump (only the `z` digit changed):

- Fix incorrect lines in `docs/api-design.md` and `content/docs/technical/api-reference.md`
- Fix env table rows in `content/docs/technical/environment-variables.md`
- Fix architecture or FAQ sentences that now describe wrong behavior
- Skip large rewrites unless the patch changed documented behavior

### 3. Minor releases — broader sync

For a **minor** bump (the `y` digit changed), check and update all relevant files:

| What changed | Files to update |
|--------------|-----------------|
| API endpoints | `docs/api-design.md`, `content/docs/technical/api-reference.md` |
| Data models / schema | `docs/data-models.md`, `content/docs/technical/data-models.md` |
| Architecture / new jobs | `docs/PLAN.md`, `content/docs/technical/architecture.md` |
| Env vars / settings | `content/docs/technical/environment-variables.md` |
| Deploy / infra | `content/docs/technical/deployment.md` |
| User-visible flows | relevant `content/docs/user-guide/*.md` files |
| Roadmap progress | `docs/PLAN.md` checkboxes or status markers |

### 4. Parity rule

When two doc trees cover the same topic (`docs/*` for developers and `content/docs/technical/*` for the docs site), update **both** so they do not contradict each other. For API and data-model topics this is mandatory; for architecture or deployment it is strongly recommended.

### 5. Context files

If the change affects high-level operator facts (stack, integrations, core flow summary), update:

- `_context/context.md`
- `_context/architecture.md`, `_context/stack.md`, `_context/conventions.md`, or `_context/integrations.md` as appropriate

Follow the existing project-context update conventions.

### 6. AGENTS.md

If the change adds a new common task pattern, key file, or model, add or update the relevant section in `AGENTS.md`.

### 7. No second version bump

Doc-only follow-up edits after a release do **not** get their own version bump unless the team explicitly treats documentation as a release artifact. This aligns with the project's release-management rule: "skip versioning for docs-only changes."

## Cross-references

- Version bump decisions: `.cursor/skills/changelog-versioning/SKILL.md`
- Always-applied release rules: `.cursor/rules/release-management.mdc`
