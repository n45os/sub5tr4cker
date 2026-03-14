# Changelog

All notable changes to this project will be documented in this file.

## [0.19.0] - 2026-03-18

### Added
- **Webhook diagnostics endpoint** — Added `GET /api/telegram/webhook-info` (auth-protected) to fetch Telegram `getWebhookInfo` details, including pending update count and Telegram's last delivery error data.
- **Webhook status in settings UI** — Notifications settings now include a **Check webhook status** action and a webhook status panel (URL, pending updates, last error message/date) so admins can verify bot delivery health directly in the dashboard.
- **Telegram welcome magic-link email** — Added `buildTelegramWelcomeEmailHtml` so members who join via Telegram invite link receive a styled onboarding email with a secure magic sign-in link to the group dashboard.

### Changed
- **Telegram invite deep-link onboarding** — `handleInviteLink` now auto-creates or links the member user, binds Telegram chat details, sets member acceptance, and sends a one-time welcome email with a magic login callback link.
- **Webhook handler resilience** — `POST /api/telegram/webhook` now validates malformed JSON payloads and adds explicit error handling around settings reads for clearer operational failures.
- **Invite acceptance resilience** — `GET /api/invite/accept/[token]` is now wrapped in guarded error handling to return a user-facing HTML failure page instead of an uncaught 500.
- **Settings decryption safety** — `decryptValue` now catches crypto decrypt failures and returns `null` instead of throwing, preventing app-wide 500 cascades when encrypted settings were written under a different secret key.

## [0.18.0] - 2026-03-18

### Added
- **Magic-link invite sign-in** — Clicking "Accept invite" in an invite email now signs you in and redirects you to the group page. If you don't have an account yet, a passwordless account is created and you land on the group; you can set a password later in Profile or sign in with Google.
- **Invite callback page** — `/invite-callback` handles the magic token from the accept flow: it calls the magic-invite credentials provider and redirects to the group (or shows an error with a sign-in link if the token expired).
- **callbackUrl across auth** — Login and register pages accept `callbackUrl` and `email` query params. After sign-in or registration, you are redirected to the requested URL (e.g. a group page). Dashboard layout redirects unauthenticated users to `/login?callbackUrl=<current path>` so you return to the page you tried to open after signing in.

### Changed
- **Accept invite handler** — `GET /api/invite/accept/[token]` now finds or creates a User for the member's email, links `member.user`, sets `member.acceptedAt`, creates a short-lived magic login token, and redirects (302) to `/invite-callback?token=...&groupId=...` instead of returning a static HTML page.
- **Auth** — New `magic-invite` credentials provider validates the 5-minute HMAC magic token and signs the user in.

## [0.17.0] - 2026-03-18

### Added
- **Health check endpoint** — `GET /api/health` returns `{ status: "ok" }` for Docker and reverse proxy health checks.
- **Portainer deployment** — `docker-compose.portainer.yml` for running SubsTrack as a standalone Portainer stack (app + MongoDB + cron). App image: `ghcr.io/n45os/sub5tr4cker:latest`.
- **CI/CD workflow** — `.github/workflows/deploy-ghcr.yml` builds the app image on push to `main`, pushes to GitHub Container Registry, and optionally triggers a Portainer webhook when `PORTAINER_WEBHOOK_URL` is set.
- **Dockerfile cron stage** — New build target `cron` for the cron runner container (used by the Portainer compose file).
- **README deployment docs** — "Production deployment (Portainer)" and "Deploy your own instance" sections with setup checklists and env var reference.

### Changed
- **.gitignore** — Added `.env.portainer` so stack-specific env files are never committed.

## [0.16.0] - 2026-03-18

### Added
- **Telegram account linking on Profile** — Profile page now has a Telegram card where you can connect or disconnect your Telegram account. Click "Connect Telegram" to get a deep link (valid 15 minutes); open it in Telegram to link. Admins and members can use this to receive confirmation nudges and reminders via Telegram.
- **Notification preferences on Profile** — New Notification preferences card on Profile: toggle email and Telegram channels, set reminder frequency (once per period, daily, every 3 days). Telegram toggle is only available after linking Telegram. Preferences are persisted via `PATCH /api/user/profile`.
- **GET /api/user/profile** — Returns current user profile including `telegram` (chatId, username, linkedAt) and `notificationPreferences` (email, telegram, reminderFrequency).
- **DELETE /api/telegram/link** — Unlinks the current user's Telegram account and turns off Telegram notifications.
- **Email invite acceptance link** — Invite emails now include a member-specific `Accept invite` link. Opening that link validates a signed token and marks that exact group member invitation as accepted, so invites are explicitly accepted from email.

### Changed
- **PATCH /api/user/profile** — Accepts optional `notificationPreferences` (email, telegram, reminderFrequency) in addition to email. Response now includes telegram and notificationPreferences.
- **Telegram link handler** — When a user links their account via the bot, `notificationPreferences.telegram` is set to `true` so they receive Telegram notifications by default.

## [0.15.0] - 2026-03-18

### Added
- **Member-specific Telegram invite link** — Invite emails (and Telegram invite messages) now include a clickable deep link (`t.me/Bot?start=invite_<token>`) that identifies the invited member. When the recipient opens the link and starts the bot, the bot links their Telegram to the correct account if they are already registered, or instructs them to register with the invited email and link from Settings.

## [0.14.0] - 2026-03-18

### Added
- **Profile page** — New dashboard page **Profile** (`/dashboard/profile`) where you can change your account email. Sidebar includes a Profile link. Email is validated and must be unique; after update, the session reflects the new address so you can sign in with it next time.

### Changed
- **Session data** — Auth session callback now loads user email, name, and image from the database on each request so profile changes (e.g. updated email) are reflected without signing out.

## [0.13.0] - 2026-03-18

### Added
- **Invite after adding a member** — When an admin adds a new member, a dialog asks whether to send an invite email. Choosing "Send invite" calls the new send-invite endpoint; "Skip" closes the dialog. Invite content matches the bulk initialize flow (group details, payment instructions, Telegram).
- **Send-invite endpoint** — `POST /api/groups/[groupId]/members/[memberId]/send-invite` sends an invite notification (email and/or Telegram) to a single member. Admin only.
- **Reply-to email setting** — New app setting `email.replyToAddress` (env: `EMAIL_REPLY_TO`). When set, all outgoing emails use this as the Reply-To header so recipients can reply to a specific inbox.
- **Email delivery tracking** — Notifications API and Activity feed now include `externalId` (e.g. Resend message id for email). Activity log shows Message ID for email notifications so admins can verify delivery or trace in Resend.

### Changed
- **From address** — Settings description for `email.fromAddress` clarified; value is used as the sender on all outgoing emails.
- **Add member flow** — Adding a member no longer sends an invite automatically; the admin is prompted after add and can send invite or skip.

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
