# Changelog

All notable changes to this project will be documented in this file.

## [0.39.3] - 2026-05-04

### Fixed

- **n450s OAuth account linking when userinfo omits email** — `linkOrCreateUserForIdentity` now treats the verified access token’s `email` claim like `/oauth/userinfo` email when deciding whether an existing `User` row (e.g. registered with a real address) should receive `authIdentityId`, avoiding duplicate placeholder users (`*@n450s.local`) that only matched `members.email` and saw a subset of groups.
- **Session display for federated users** — `resolveSessionFromPayload` prefers the database mailbox over synthetic `@n450s.local` from the JWT and ignores vague token display names (e.g. `Dashboard`) when the local profile has a real name.

## [0.39.2] - 2026-05-04

### Fixed

- **n450s login loop after successful callback** — `User.authIdentityId` is now set from the **verified access token `sub`**, matching `auth()` / `resolveSessionFromPayload`, instead of `/oauth/userinfo` `sub` when those differ (e.g. token carries both `sub` and `backendUserId`). Existing rows linked under the mistaken id are updated on the next successful login.

## [0.39.1] - 2026-05-03

### Fixed

- **n450s OAuth behind Docker / reverse proxy** — After login, redirects no longer send the browser to an internal hostname (e.g. container id `:3000`). Post-login Location, logout return URL, and `redirect_uri` selection now derive the public origin from `general.appUrl` / `APP_URL`, then `X-Forwarded-Host` / `X-Forwarded-Proto`, before falling back to the request URL.

## [0.39.0] - 2026-05-03

### Added

- **Telegram admin verification buttons** — The admin nudge that fires when a member self-confirms now ships with inline buttons: a per-member ✅ confirm + ✕ reject pair, plus a "✅ Confirm all (N)" bulk action. Tapping ✅ runs through the shared `applyAdminPaymentDecision` helper (same path as the dashboard route), edits the message to drop the just-handled member, and re-renders only the still-unverified rows. ✕ resets the payment to `pending`, clears `memberConfirmedAt`, and DMs/emails the member that they need to re-pay. "Confirm all" bulk-flips every `member_confirmed` payment in one update through `confirmAllMemberConfirmed`. Per-member rows include the self-confirm relative timestamp ("30m ago"). When the keyboard would exceed 8 member rows the bot falls back to a single dashboard link to stay within Telegram's practical inline-keyboard limits, and every callback_data string stays under the 64-byte cap even with 24-char Mongo ObjectIds.

### Changed

- **Authentication (advanced mode)** — Migrated from Auth.js v5 (Credentials + Google + Magic-invite providers) to **n450s_auth** as the upstream identity provider. Login is a single "Continue with n450s" CTA that redirects to `<AUTH_SERVICE_URL>/oauth/consent`; sub5tr4cker exchanges the authorization code at the n450s `/api/auth/n450s/callback` route, stores access + refresh tokens in HttpOnly cookies (`s5_at`, `s5_rt`), and the new middleware silently refreshes the access token on every request that's within the expiry window. **Sliding 7-day refresh tokens give effectively-persistent sessions** for any user who interacts with the app at least once a week — the long-standing "users get logged out" complaint is the entry motivation for the migration. Google sign-in is now federated by n450s_auth itself; sub5tr4cker no longer carries a Google button or `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. **Local mode (`SUB5TR4CKER_MODE=local`) is unchanged** — token-cookie auto-login (`src/lib/auth/local.ts`) is preserved.
- **User model** — `User.authIdentityId` (sparse unique) added to link local users to n450s identities. Migration script `scripts/link-existing-users-to-n450s.ts` (dry-run by default, `--apply` to write) reconciles existing users by email; idempotent on re-run. `User.hashedPassword` is deliberately retained for one release as a rollback safety net — it will be dropped in a separate plan.
- **Operator action required at cutover** — Register the `sub5tr4cker` OAuth client in the production n450s_auth, set `AUTH_SERVICE_URL` / `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` / `OAUTH_REDIRECT_URIS`, run the linking script, and follow the runbook in `.clowalky/_plans/migrate-auth-to-n450s/phase-09-cutover-log.md`. The runbook also lists the rollback path (re-deploy the previous image; legacy env vars + `hashedPassword` are intact).

### Removed

- `/api/auth/[...nextauth]` and `/api/register` routes (NextAuth no longer mounted in advanced mode).
- `Credentials` and `MagicInvite` providers; `MongoDBAdapter` initialisation; `verifyMagicLoginToken` from `src/lib/tokens.ts`.
- The dedicated Google sign-in button on the login page (Google now federated through n450s_auth).

## [0.38.5] - 2026-03-31

### Changed

- **Setup wizards** — `s54r init` and `pnpm setup` now steer people toward **Telegram** first: in-app notes explain that members confirm payment more easily in the bot than from email. Local init lists Telegram first with **recommended**; choosing **both** sets `defaultChannel` to Telegram.
- **Docs** — README quick start and advanced prerequisites, plus the getting-started guide, match that guidance.

## [0.38.4] - 2026-03-27

### Fixed

- **Notify all unpaid / reminders** — User resolution now also looks up `getTelegramPlaceholderEmail(memberId)`, matching Telegram-only invite accounts when billing payments omit `memberEmail`. Aggregated sends skip real email to `@telegram.sub5tr4cker.local` so the Telegram path is not paired with a doomed Resend attempt. Dashboard notify POST logs `sendAggregatedReminder` errors to the server console.

## [0.38.3] - 2026-03-27

### Changed

- **`s54r notify`** — If reminders were enqueued but the worker claimed nothing on the first pass, runs one short-delay second pass (helps odd timing). File comment notes using `pnpm s54r notify` from the repo so the CLI matches source (stale global `dist/cli` can still run worker-before-enqueue from older builds).
- **Telegram polling** — When `pollOnce` skips because `s54r start` holds the lock, the log line now explains that the running server already processes updates (not a failure).

## [0.38.2] - 2026-03-27

### Fixed

- **Reminders + “Notify all unpaid”** — User lookup for delivery no longer relies only on `member.userId`. The app now merges **`member.userId`**, **`member.email`**, and **`payment.memberEmail`** (and prefers an account with Telegram linked when choosing among candidates). This fixes members who linked Telegram from the web profile without a group `userId`, stale `userId` rows, and aggregation keys that only had payment email.

## [0.38.1] - 2026-03-27

### Fixed

- **`s54r notify`** — Runs `enqueueReminders` before `runNotificationTasks`, matching `POST /api/cron/reminders`. Previously the worker ran first, so tasks enqueued in the same invocation were not sent until the next cron/notify run.
- **Telegram reminder text** — Payment and aggregated reminder DMs escape dynamic fields for HTML parse mode, avoiding silent send failures when names, links, or notes contain `&`, `<`, or `>`.

## [0.38.0] - 2026-03-27

### Added

- **Telegram bot commands** — `/services` lists your groups, typical share, and open-period payment status; `/help` explains reminders and buttons. The bot registers these with Telegram (`setMyCommands`) on startup.
- **Rich invite welcome** — After a member opens an `invite_<token>` deep link, the bot sends billing summary, payment details, what happens next, and command hints (not only a one-line confirmation).

### Fixed

- **Telegram + new invite users** — First-time users created from a Telegram invite now persist `telegram.chatId` (previously only existing users did), so the admin members panel shows **Telegram connected** correctly.
- **Invite reply vs email** — The bot no longer says “check your email” when no welcome email was sent (e.g. Telegram-only members with no real email).

### Changed

- **Profile link success & generic `/start`** — Linking from the web profile and plain `/start` messages now point to `/services` and `/help`, with local-mode wording that prioritizes invite links.

## [0.37.1] - 2026-03-27

### Fixed

- **Local auth startup** — `s54r start` no longer initializes the MongoDB Auth.js adapter in local mode, so SQLite/local installs stop throwing `ECONNREFUSED` errors when MongoDB is not running.
- **Telegram polling in local mode** — `s54r start` now sets local-mode environment variables on the parent CLI process (not only the spawned Next.js child), so Telegram polling handlers resolve the correct SQLite storage adapter instead of falling through to MongooseAdapter.
- **Telegram member invites** — Member-specific Telegram deep links now validate correctly for SQLite/local-mode member ids instead of assuming MongoDB ObjectIds, so opening the copied `t.me/...start=invite_<token>` link works again in local installs.
- **Group member channel status** — The admin members panel now hides `Email connected` when the workspace email channel is disabled, matching the actual delivery behavior controlled by `email.enabled`.

## [0.37.0] - 2026-03-26

### Added

- **Notifications hub** — `/dashboard/notifications` now combines workspace email setup, Telegram setup, delivery behavior, template previews, and direct links to the delivery log and scheduled sends.

### Changed

- **Admin navigation** — Dashboard shortcuts, sidebar labels, group delivery settings placement, and page headers now make delivery history, scheduled sends, settings, and notification setup easier to reach.
- **Channel controls** — Workspace-level `email.enabled` and `telegram.enabled` toggles now let admins disable either outbound channel without removing the underlying configuration.
- **Telegram-only members** — Group members and billing snapshots can now exist without an email address; reminder aggregation and activity logs use recipient labels and member/user identity instead of assuming email is always present.

## [0.36.0] - 2026-03-26

### Added

- **Admin Telegram invite links** — Pending members now expose a copyable `t.me/...start=invite_<token>` deep link in the members table, and admins can fetch the same link via `GET /api/groups/[groupId]/members/[memberId]/telegram-invite`.

### Changed

- **Local invite UX** — Web self-join invite links are now treated as unavailable when `general.appUrl` is missing or points to a local/private host (`localhost`, loopback, or LAN/private IPs). The group invite-link card explains why and points admins to Telegram invite links instead.
- **Invite notifications** — Member invite emails keep Telegram onboarding available in local/private deployments, but stop embedding unusable web accept links unless the app has a public URL.

## [0.35.1] - 2026-03-26

### Fixed

- **`s54r start`** — Prefer `next start` from the package root when `node_modules/.bin/next` exists so `better-sqlite3` loads its native binding. The Next.js standalone server alone often lacks the compiled `.node` file under `.next/standalone/node_modules`.

## [0.35.0] - 2026-03-26

### Changed

- **StorageAdapter coverage** — Remaining API routes, billing cron jobs, Activity (`GET /api/activity`, email preview), public member portal page, grammy telegram handlers (`/start` linking, payment confirm/reject, pay details), and advanced-mode **Settings** persistence now go through `db()` / `StorageAdapter` instead of direct Mongoose calls. `@/models` imports are confined to `mongoose-adapter.ts` and schema files.
- **Adapter API** — Added helpers used by the above: e.g. `getBillingPeriodById`, `findActiveGroupForMemberInvitation`, `listNotifications` / `getNotificationById`, `linkTelegramAccountWithLinkCode`, `tryClaimWelcomeEmailSentAt`, app settings `ensureAppSettingsSeeded` / `getAppSettingRow` / `listAppSettingRows` / `upsertAppSettingRow`, `listAuditEvents({ unbounded })` for activity merge.
- Removed legacy `buildOpenOutstandingPeriodsQuery` export from `billing-snapshot.ts`.

## [0.34.0] - 2026-03-26

### Added

- **Local-first mode (`s54r`)** — New `s54r` CLI command (bin alias added alongside `substrack`). Run `npx s54r init` for a guided terminal setup wizard (notification channel, admin email, auth token). `s54r start` launches the web UI on `localhost:3054` in foreground mode; `s54r notify` is a standalone cron script that polls Telegram and sends due reminders without the web server running.
- **SQLite storage adapter** — `SqliteAdapter` (`src/lib/storage/sqlite-adapter.ts`) provides a fully embedded, zero-config data store backed by `better-sqlite3`. Stores all documents as JSON columns with extracted indexed fields. Implements the complete `StorageAdapter` interface.
- **Storage adapter layer** — `StorageAdapter` interface (`src/lib/storage/adapter.ts`) with domain-agnostic types (`src/lib/storage/types.ts`). `MongooseAdapter` wraps the existing Mongoose calls behind the same interface. Adapter factory (`src/lib/storage/index.ts`) selects SQLite or Mongoose based on `SUB5TR4CKER_MODE` env var.
- **Adapter conformance tests** — 20 tests in `src/lib/storage/__tests__/adapter-conformance.test.ts` validate all storage operations (groups, billing periods, payments, notifications, scheduled tasks, price history, export/import round-trip).
- **Config manager** — `src/lib/config/manager.ts` reads/writes `~/.sub5tr4cker/config.json` with Zod validation. Provides `getAppMode()`, `getLocalSetting()`, `setLocalSetting()` and data directory helpers.
- **Settings service local branch** — `getSetting()` / `setSetting()` now short-circuit to `config.json` in local mode, skipping MongoDB entirely.
- **Local auth** — `src/lib/auth/local.ts` generates and validates a token cookie (`sub5tr4cker-local-auth`). `auth()` in `src/lib/auth.ts` returns a synthetic admin session in local mode. Middleware auto-sets the cookie on localhost requests.
- **Export / import** — `s54r export` produces a versioned `ExportBundle` JSON file. `s54r import <file>` imports it into the active adapter (idempotent — skips existing IDs). `s54r migrate` exports SQLite data, imports it into MongoDB, and switches config mode.
- **OS-native cron** — `s54r cron-install` installs `s54r notify` as a scheduled task: `crontab` on Linux, `launchd` on macOS (plist written to `~/Library/LaunchAgents/`), PowerShell instructions on Windows.
- **Uninstall flow** — `s54r uninstall` prompts for backup export, then removes `~/.sub5tr4cker/` and cron entries.
- **Telegram polling** — `src/lib/telegram/polling.ts` adds `pollOnce()` (one-shot for cron) and `startPolling()` (grammy long-poll loop for `s54r start`). Polling offset is persisted in `config.json` to avoid re-processing.

## [0.33.0] - 2026-03-24

### Added

- **Activity sent email preview** — Optional per-group `notifications.saveEmailParams` (default off). When enabled, structured template arguments for outgoing emails are stored on `Notification.emailParams`; Activity shows **View email** and `GET /api/activity/notifications/[notificationId]/email` rebuilds HTML via the same template builders. Group notifications panel includes the toggle; `GET /api/activity` notification items include `hasEmailParams`.

## [0.32.0] - 2026-03-24

### Added

- **Payment in advance** — Per-group `billing.paymentInAdvanceDays` (0–365): the billing period is created and unpaid tracking opens that many days before each renewal (cycle day). Each `BillingPeriod` stores `collectionOpensAt` (denormalized at creation). Automated reminders use **grace period from collection open** (first reminder when `now >= collectionOpensAt + gracePeriodDays`). Manual **Notify unpaid**, dashboard unpaid counts, cron `enqueue-reminders`, and `enqueue-follow-ups` use the same “collection window open” rule (`$expr` on `collectionOpensAt` with legacy fallback to `periodStart`). Pending → **overdue** (`reconcile-overdue`) stays anchored to **14 days after period start** (renewal). Run `pnpm tsx scripts/backfill-collection-opens-at.ts` once on existing databases to set `collectionOpensAt` on old periods (optional; queries already fall back for missing fields).

### Changed

- **Grace period semantics** — Documented and implemented as days after the collection window opens (not “after billing day” only). When `paymentInAdvanceDays` is 0, collection opens on the renewal day, matching previous behavior.

## [0.31.1] - 2026-03-24

### Fixed

- **Dashboard “groups needing attention”** — `GET /api/groups` `unpaidCount` and `GET /api/dashboard/quick-status` now use the same open-period aggregation (all relevant billing periods, not only the latest). Workspace pulse counts only groups you **own**. Quick status clarifies open follow-ups vs payment reminders; `groupsEligibleForReminders` matches bulk notify. Response adds `groupsNeedingAttention` and `groupsEligibleForReminders`; `groupsWithPendingOverdue` is kept as an alias of `groupsNeedingAttention` for compatibility.

## [0.31.0] - 2026-03-24

### Added

- **Documentation** — `docs/api-design.md` now documents product flows (billing, notification queue vs manual notify, member confirm paths), cron auth note (`x-cron-secret`), and additional routes (dashboard, activity, payments, user, plugins, health, unsubscribe, invite accept, member portal Telegram link). `docs/PLAN.md` includes a notification pipeline diagram.

### Changed

- **Dashboard UX** — Group actions: **Edit** stays visible; **Initialize**, **Import history**, and **Delete** moved under a **⋯** menu. Admin **Subscriptions you pay for** table uses a per-row **⋯** menu (Open / Delete). Header: removed duplicate **Create group** and non-interactive avatar strip; breadcrumbs include **Scheduled tasks**, **Payments**, group name (from sidebar data), and **Billing** on the billing sub-route. Settings **Notifications** tab groups test/register/check actions under **Quick actions**. **Scheduled tasks** bulk cancel and **Reject** payment (matrix) require confirmation; Telegram **Disconnect** confirms. Notifications panel on the group page defaults **expanded**. Billing-only page no longer duplicates import (use group page).
- **Payments summary** — Top cards show a single currency label when all rows match, or **mixed** when currencies differ (instead of hardcoded EUR).

### Fixed

- **Admin reject payment (HTTP)** — `POST .../billing/[periodId]/confirm` with `action: "reject"` now clears `memberConfirmedAt`, matching Telegram admin reject.

### Removed

- **Dead job** — Deleted unused `src/jobs/send-reminders.ts` (reminders use `enqueue-reminders` + worker).
- **Scheduled task types** — `price_change`, `invite`, and `follow_up` removed from `ScheduledTask` schema and filters (they were never enqueued; worker could not execute them). Existing MongoDB documents with those `type` values may need a one-off migration if any exist.

### Deprecated (API)

- JSDoc `@deprecated` on `GET .../notification-preview`, `GET /api/notifications/templates`, and `GET /api/notifications/templates/[type]/preview` — first-party UI uses template helpers directly.

## [0.30.0] - 2026-03-23

### Added

- **Scheduled tasks (admin)** — Dashboard page **Scheduled tasks** lists queued notification tasks for groups you administer; cancel pending/locked tasks, retry failed ones, or bulk-cancel by group id, member email (aggregated reminders), or task type. APIs: `GET /api/scheduled-tasks`, `PATCH /api/scheduled-tasks/[taskId]`, `POST /api/scheduled-tasks/bulk-cancel`.
- **`cancelled` status** on `ScheduledTask` plus `cancelledAt` for admin cancellations.

### Fixed

- **Reminder worker** — Skips sending when a payment is no longer `pending` or `overdue` at execution time (avoids reminders after a paid member was still queued).

### Changed

- **Dialog footers** — Clearer labels (e.g. close without notifying, skip without sending) and consistent button spacing (`gap-2` on desktop); removed redundant extra **Close** buttons where **Cancel** already dismisses.

## [0.29.0] - 2026-03-23

### Added

- **Delete group (UI)** — Admins can remove a group from the dashboard via the group header, the home **Subscriptions you pay for** admin table, or the **Danger zone** on the edit group screen (soft delete; existing `DELETE /api/groups/[groupId]`).
- **Admin services table on dashboard** — The home page shows a table of subscription groups you own (service, pricing, members, next cycle, unpaid attention) with Open and Delete actions.

## [0.28.0] - 2026-03-21

### Added

- **Group email themes with live preview** — Each group now supports a selectable notification style preset (`clean`, `minimal`, `bold`, `rounded`, `corporate`) in the group form, with a live reminder preview before saving.
- **Notification preview tooling** — Added a group-scoped notification preview API and a template-center theme switcher so admins can inspect template variants quickly.

### Changed

- **Template system redesign** — All core email templates now use a shared layout/theme shell for consistent structure, stronger hierarchy, and improved readability.
- **Payment-focused reminder UX** — Reminder emails now include payment method details (platform/link/instructions) and use “Verify payment” actions that route members to the member portal flow instead of instant confirmation links.
- **Member portal pay-link experience** — Member portal now supports deep links (`?pay=...&open=confirm`) to preselect a period and open the confirmation dialog directly from notifications.

## [0.27.0] - 2026-03-20

### Added

- **Telegram payment reminders** — Inline button **Show paying details** sends a follow-up message with the group’s payment platform, pay link, free-text instructions, and optional admin note (hidden on multi-group aggregated reminders where a single details block would be misleading).

## [0.26.3] - 2026-03-19

### Fixed

- **Aggregated reminder copy** — Combined payment reminders now count distinct billing periods and subscription groups instead of treating each period line as a separate “group” (email body, subject line, and Telegram intro).
