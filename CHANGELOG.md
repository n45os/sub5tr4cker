# Changelog

All notable changes to this project will be documented in this file.

## [0.12.0] - 2026-03-18

### Added
- **Persisted notification task queue** — Notification delivery (payment reminders, admin confirmation nudges) now uses a `ScheduledTask` model. Cron jobs enqueue tasks with idempotency keys; a worker process claims and executes due tasks via the notification service. Retries use exponential backoff; stale locks are recovered automatically.
- **New cron endpoint** — `POST /api/cron/notification-tasks` runs the notification worker. Intended to be called frequently (e.g. every 5 min) when using HTTP-triggered cron; response includes task counts (pending, locked, completed, failed) for observability.
- **Task queue library** — `src/lib/tasks/` provides `enqueueTask`, `claimTasks`, `completeTask`, `failTask`, `getTaskCounts`, and idempotency key builder. Worker dispatches by task type (`payment_reminder`, `admin_confirmation_request`).
- **Admin nudge helper** — `sendAdminConfirmationNudge(group, period)` in `src/lib/notifications/admin-nudge.ts` for use by the worker and tests.

### Changed
- **Cron flow** — Reminders cron now enqueues payment reminder tasks and runs the worker; follow-ups cron reconciles overdue state (pending → overdue), enqueues admin nudge tasks, and runs the worker. Standalone runner adds a job every 5 minutes to process the notification queue.
- **Confirm and Telegram flows** — When a member confirms payment (email link or Telegram), the app enqueues an `admin_confirmation_request` task and runs the worker so the admin receives the nudge through the notification service (email + Telegram) with consistent logging and retries.
- **Cron API responses** — `POST /api/cron/reminders` returns `enqueued` and `worker`; `POST /api/cron/follow-ups` returns `overdueReconciled`, `adminNudgesEnqueued`, and `worker`.
- **Docs** — Architecture plan, API design, data models, README, deployment, and context files updated to describe the task queue, worker, and migration from inline cron delivery.

## [0.11.0] - 2026-03-18

### Added
- **Per-group accent color** — Admins can set an optional accent color (hex) per group in the group form (create/edit). The color is used as the accent in notification emails (headers, primary buttons) for that group. Stored as `service.accentColor`; validated as 6-digit hex (e.g. `#3b82f6`).
- **Automated-message badge** — All notification email templates now show a clear “This is an automated message from your subscription group.” badge near the top so recipients know the email is system-generated.
- **Email branding helper** — Shared `src/lib/email/branding.ts` provides `getAccentColor()`, `buildAutomatedMessageBadgeHtml()`, and default accent; payment reminder, group invite, price change, and admin follow-up templates use them.

### Changed
- Group model and APIs: `service` object now supports optional `accentColor`. POST/PATCH group payloads accept it; GET group and list responses include it when present.
- Notification previews (dashboard templates) use the default accent and the new automated-message badge so preview matches delivered emails.

## [0.10.0] - 2026-03-18

### Added
- **Dashboard quick status** — New “All groups quick status” section on the dashboard with at-a-glance stats (groups, needing attention, pending/overdue counts, member-confirmed awaiting admin).
- **Notify all unpaid** — Bulk action to send payment reminders to all unpaid (pending/overdue) members across admin-owned groups. Button opens a confirmation modal that shows a preview: how many reminders will be sent by email and Telegram, per-group breakdown, and skip reasons (unsubscribed, email/Telegram prefs off, Telegram not linked, no reachable channel). Delivery respects each member’s preferences; unsubscribed members never receive email. Manual send bypasses grace period.
- **Dashboard APIs** — GET `/api/dashboard/quick-status` (admin-only aggregate stats). GET `/api/dashboard/notify-unpaid` (preview with eligibility and skip reasons). POST `/api/dashboard/notify-unpaid` (execute send; returns sent/skipped/failed counts).
- **Shared reminder targeting** — `reminder-targeting` and `reminder-send` libs centralize eligibility and channel resolution. Cron reminder job uses the same logic; skip reasons are explicit (unsubscribed_from_email, email_pref_off, telegram_pref_off, no_telegram_link, no_reachable_channel).

## [0.9.0] - 2026-03-18

### Added
- **Payment matrix** — Billing tab on group detail now shows a grid: periods as rows, members as columns. Each cell is a checkbox-style control: admins can confirm, reject, or waive payment via dropdown; members can mark “I’ve paid” for their own pending/overdue cell. Tooltips show member, amount, status, and confirmation timestamps.
- **Payment status badges** — New `PaymentStatusBadge` component with distinct colors and icons for confirmed (green), member confirmed (sky blue), pending (amber), overdue (red), and waived (muted). Used on the payments page and in the matrix.
- **Per-member payment history** — Members tab has expandable rows; each member shows a “X/Y periods paid” summary and, when expanded, a list of periods with amount, status badge, and member/admin confirmation dates. Billing API supports optional `memberId` filter.
- **Audit events** — New `AuditEvent` model and `logAudit()` helper. Payment confirm/reject/waive, self-confirm, group create/edit, member add/remove/update, and billing period create are logged with actor, action, and context.
- **Activity log: actions** — Activity API and page support a “source” filter: All, Notifications, or Actions. Actions show user-triggered events (payment confirmed, member added, etc.) with actor name and type-specific icons. Timeline-style layout with distinct styling for notifications vs actions.

### Changed
- **Fonts** — Body font is now DM Sans, display font is Space Grotesk; Syne is used only for the logo (“sub5tr4cker”). JetBrains Mono unchanged.
- **Theme** — Accent and primary palette switched from green/teal (hue 130) to sky blue (hue 230) in light and dark mode. New semantic status colors for payment/notification states (`--status-confirmed`, `--status-pending`, etc.).
- **Billing API** — GET `/api/groups/[groupId]/billing` returns `memberConfirmedAt` and `adminConfirmedAt` per payment. Optional query `memberId` filters periods to that member’s payments. Confirm route accepts action `"waive"` in addition to `"confirm"` and `"reject"`.
- **Activity page** — Sent tab uses a timeline of cards with type-specific icons and colors; filter bar includes “Show: All / Notifications / Actions”. Upcoming tab styling aligned with new spacing and typography.
- **Payments page** — Uses `PaymentStatusBadge` and polished filter selects; tabular-nums on date columns.

## [0.8.0] - 2026-03-18

### Added
- **Activity log** — Dashboard page at `/dashboard/activity` with Sent and Upcoming tabs. Sent tab lists past notifications (type, channel, recipient, group, subject, status) with filters by type and channel. Upcoming tab shows predicted reminder and admin follow-up runs for the next two weeks based on cron schedules.
- **Payments page** — Dashboard page at `/dashboard/payments` with summary cards (collected, pending, overdue) and a filterable table of all payment records across groups the user admins. Filters by group and status; links to group billing.
- **Seed script** — `pnpm seed` populates a demo group "YouTube Premium Family" with 5 months of billing periods, mixed payment statuses (confirmed, member_confirmed, pending), reminder entries, and notification logs. Creates demo users (`admin@demo.local` / `demo1234` and members). Idempotent: removes existing `*@demo.local` data before seeding.

### Changed
- Sidebar and header: added Activity and Payments nav items and breadcrumbs.

## [0.7.0] - 2026-03-18

### Added
- **App rename to sub5tr4cker** — Project and UI now use the name sub5tr4cker; repo intended for `n45os/sub5tr4cker` on GitHub.
- **Email footer** — All transactional emails include a footer with app name, link to GitHub repo (https://github.com/n45os/sub5tr4cker), and an unsubscribe link when applicable.
- **Unsubscribe from reminder emails** — Members can click “Unsubscribe” in reminder, invite, and price-change emails to stop receiving those emails for that group. GET `/api/unsubscribe/[token]` handles the action and redirects to `/unsubscribed`.
- **Admin Telegram on unsubscribe** — When a member unsubscribes from emails, the group admin receives a Telegram notification (if Telegram is linked).

### Changed
- Group member schema: added `unsubscribedFromEmail` (default `false`). Reminder, invite, and price-change flows skip email for unsubscribed members (Telegram still used when configured).
- Default email “from” and settings placeholder updated to sub5tr4cker.

## [0.6.0] - 2026-03-18

### Added
- **Invite link self-join**: Admins can generate a shareable invite link from the group detail page. Anyone with the link can join the group by entering email and display name (no login required). New endpoints: GET/POST/PATCH/DELETE `/api/groups/[groupId]/invite-link` (admin), GET `/api/invite/[inviteCode]` (public preview), POST `/api/groups/join` (public join).
- **Invite link controls**: Admin can lock registration (link stays valid but joins are rejected), re-enable it, or revoke the link entirely. Group model adds `inviteLinkEnabled`; `inviteCode` is cleared on revoke.
- **Public invite page**: `/invite/[inviteCode]` shows group preview and a join form; handles invalid/revoked/disabled states with clear messages.
- **Invite code utility**: `src/lib/invite-code.ts` for URL-safe random codes with uniqueness check against existing groups.

### Changed
- Group schema: added `inviteLinkEnabled` (default `false`). Joins via invite require both `inviteCode` and `inviteLinkEnabled`.

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
