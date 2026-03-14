# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-03-18

### Added
- **Initialize & Notify group**: Admins can send a one-time invite/welcome notification to all active members from the group detail page. Email content adapts to public vs private app (based on `general.appUrl`): public apps get "View group" and "Manage notifications" links; private apps get reply instructions and Telegram bot setup steps. New template `group-invite` and POST `/api/groups/[groupId]/initialize`; optional `initializedAt` on Group to support re-notify with a warning.
- **Plugin system**: Installable notification templates and channels from GitHub repos. Manifest format `substrack-plugin.json` with `templates` and `channels`; validation and loader in `src/lib/plugins/`. Template registry merges built-in and plugin templates; channel registry merges built-in (email, telegram) with plugin channels. Notification service uses the channel registry for sending.
- **CLI plugin commands**: `pnpm substrack plugin add <repo>`, `plugin remove <slug>`, `plugin list` to clone from GitHub, validate manifest, and manage `plugins/registry.json`.
- **Plugins settings UI**: Dashboard Settings → Plugins tab lists installed plugins and allows configuring plugin channel settings (stored under `plugin.<slug>.<key>`). GET `/api/plugins` and PATCH `/api/settings` with plugin keys supported.
- **Future idea**: Full plugin system (billing modes, payment platforms, webhooks, UI extensions) logged in `_future/full-plugin-system/` for later planning.

### Changed
- Notification template list and preview now use a unified registry from `@/lib/plugins/templates` so plugin templates appear alongside built-in ones.
- Settings PATCH accepts keys matching `plugin.<slug>.<key>` for plugin configuration; Settings model and definitions support category `plugin`.

## [0.4.0] - 2026-03-18

### Added
- Added a redesigned shadcn/ui dashboard shell with a collapsible sidebar, richer overview cards, tabbed group detail pages, and a reusable group create/edit form.
- Added a full runtime settings system backed by MongoDB, including the `Settings` model, `/api/settings` endpoints, dashboard settings page, and test delivery endpoints for email and Telegram.
- Added a notification template registry, template preview pages, notification preview APIs, per-group notification toggles, and recent delivery logs in the group dashboard.
- Added `pnpm setup`, `pnpm configure`, and the new `substrack` CLI scaffolding built with `@clack/prompts` and `commander` for first-time configuration.

### Changed
- Moved runtime configuration for app URL, email, Telegram, and token/cron secrets out of direct env lookups and into the settings service with env fallback support.
- Updated reminder, follow-up, and price-change flows to reuse centralized email/Telegram template builders and respect per-group notification toggles.
- Refreshed setup and environment docs to reflect the bootstrap-only `.env.local` approach and the new onboarding command flow.

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
