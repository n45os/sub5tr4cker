---
name: changelog-versioning
description: Maintains release notes and semantic versions for substantial project changes. Use when making a big change, deciding whether a new version is needed, updating CHANGELOG.md, preparing a release note, or bumping package versions.
---

# Changelog And Versioning

Use this skill after completing a substantial change.

## Quick check

Treat the work as substantial when at least one is true:

- it adds, removes, or significantly changes product behavior
- it introduces a new endpoint, integration, background job, or workflow
- it changes schema shape, environment variables, setup steps, or operational behavior
- it fixes a bug users, admins, or operators would care about

Usually skip changelog and version bumps for:

- comments, formatting, lint-only changes, or file renames
- tests-only changes
- refactors with no behavior change
- tiny internal cleanup that would not matter in release notes

## Semver for `0.y.z`

This project is pre-1.0. The three digits mean:

- `z` (patch): bug fix, safe polish, no new capability — e.g. `0.24.0` → `0.24.1`
- `y` (minor): new feature, endpoint, job, or workflow (non-breaking) — e.g. `0.24.*` → `0.25.0`
- major (`1.0.0`+): breaking API/schema change, required migration, removed behavior

## Bump rules

Choose exactly one:

- `major`: breaking or incompatible change
- `minor`: new non-breaking capability or workflow
- `patch`: non-breaking fix, polish, or improvement with real impact

Use these decision rules:

### Major

- removed or renamed API behavior
- schema or env changes that require manual migration
- changed defaults or flows in a way that can break existing usage

### Minor

- new feature or endpoint
- new notification path, job, integration, or admin workflow
- meaningful new developer or operator capability that changes release behavior

### Patch

- bug fix with runtime impact
- non-breaking UX or operational improvement
- dependency or config update that changes shipped behavior without adding a new capability

## Required actions when a bump is needed

1. Read the current version from `package.json`
2. Compute the next semantic version
3. Update `package.json`
4. Update matching root version fields in lockfiles such as `package-lock.json`
5. Create or update `CHANGELOG.md`
6. Add a dated section for the new version with concise bullets under the right headings
7. Mention the bump reason in the final response
8. Sync docs — apply the `release-docs-sync` skill (`.cursor/skills/release-docs-sync/SKILL.md`) so the CHANGELOG deltas are reflected in `docs/`, `content/docs/`, and `_context/`

## Changelog format

Use this structure:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [x.y.z] - YYYY-MM-DD

### Added
- new capability

### Changed
- changed behavior

### Fixed
- bug fix
```

Only include headings that have entries.

## Default mapping guide

- new feature plus non-breaking rollout: `minor`
- bug fix only: `patch`
- internal tooling that changes release workflow or project operations: usually `patch`, use `minor` only if it adds a clearly new supported capability
- docs-only change: no bump

## Final response requirement

State one of these clearly:

- `Bumped version to x.y.z because ...`
- `No version bump or changelog entry was needed because ...`
