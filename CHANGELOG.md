# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-03-18

### Added
- Price-change announcements: when a group’s subscription price is updated via PATCH `/api/groups/[groupId]`, all members and the admin are notified by email and Telegram (when enabled). Respects `announcements.notifyOnPriceChange` and logs deliveries with type `price_change`.
- Email template for price-change notifications (`src/lib/email/templates/price-change.ts`) and Telegram message helper in `src/lib/telegram/send.ts`.
- `sendPriceChangeAnnouncements()` in the notifications service to dispatch to admin and active members with deduplication by email.

## [0.2.0] - 2026-03-18

### Added
- Added core groups, members, and billing API endpoints including admin payment confirmation and member self-confirmation flows.
- Added auth and dashboard surfaces: register API, credentials sign-in, login/register pages, dashboard pages, and initial feature components.
- Added Telegram integration endpoints for webhook handling and account linking, plus token generation/verification for deep-link onboarding.
- Added cron follow-ups API endpoint and a minimal Vitest setup with API route tests.

### Changed
- Updated roadmap and project context progress to reflect completed Phase 1 MVP scope and core Phase 2 Telegram/follow-up work.
- Migrated local package manager workflow to `pnpm` with `packageManager` metadata and `pnpm-lock.yaml`.
- Added a direct `mongodb@^6` dependency for adapter compatibility under pnpm.

### Fixed
- Fixed strict TypeScript build failures caused by implicit `any` in route array callbacks.
- Fixed Turbopack parsing issues by simplifying complex inline route type annotations.
- Documented the `rolldown` native-binding startup issue and the package manager remedy in project rules.

## [0.1.1] - 2026-03-18

### Added
- Added a project-wide Cursor rule for deciding when substantial changes need changelog updates and version bumps.
- Added a reusable project skill for changelog maintenance and semantic version decisions after big changes.

### Changed
- Established a standard release workflow for updating `CHANGELOG.md`, `package.json`, and lockfile version fields together.
