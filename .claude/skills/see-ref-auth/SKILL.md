---
name: see-ref-auth
description: Reference for the Auth module — Auth.js v5, local-mode token cookie, dual-mode auth() wrapper. Load explicitly when working on auth/sessions.
---

# Auth module reference

## Purpose
Dual-mode authentication: **Auth.js v5 (NextAuth)** with `MongoDBAdapter` in advanced mode, and a lightweight **token-cookie auto-login** in local mode. A single `auth()` wrapper dispatches to the correct backend so every protected route stays mode-agnostic.

## Main functionalities
- Credentials provider (email/password, bcryptjs cost 12, case-insensitive email)
- Magic-invite provider (HMAC-token passwordless link from `src/lib/tokens.ts`)
- Optional Google provider (only instantiated when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set)
- JWT sessions with 30-day max-age (advanced mode); synthetic local session in local mode
- `MongoDBAdapter` for users + accounts (advanced); `nextauth.session-token` cookie
- Local-mode token: `sub5tr4cker-local-auth` httpOnly cookie, validated with `crypto.timingSafeEqual`
- Middleware route protection + auto-cookie-set in local mode
- Telegram link-account flow (15-minute deep-link code, atomic clear on use)
- Profile preferences (notification toggles, email change with re-verification flag, password change)

## Code map

### Config + helpers
- [src/lib/auth.ts](src/lib/auth.ts) — NextAuth config, providers, callbacks, `auth()` wrapper
- [src/lib/auth/local.ts](src/lib/auth/local.ts) — `generateAndSaveAuthToken`, `validateAuthToken`, `buildLocalSession`
- [src/lib/config/manager.ts](src/lib/config/manager.ts) — config.json field source for `authToken`, `adminEmail`, `adminName`

### Pages
- [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx) + [login-form.tsx](src/app/(auth)/login/login-form.tsx)
- [src/app/(auth)/register/page.tsx](src/app/(auth)/register/page.tsx)

### API routes
- [src/app/api/auth/[...nextauth]/route.ts](src/app/api/auth/[...nextauth]/route.ts) — NextAuth handler
- [src/app/api/register/route.ts](src/app/api/register/route.ts) — registration + first-user-becomes-admin
- [src/app/api/user/profile/route.ts](src/app/api/user/profile/route.ts) — GET/PATCH profile + prefs
- [src/app/api/user/change-password/route.ts](src/app/api/user/change-password/route.ts)
- [src/app/api/telegram/link/route.ts](src/app/api/telegram/link/route.ts) — POST generate code / DELETE unlink

### Middleware + models
- [src/middleware.ts](src/middleware.ts) — local-mode auto-cookie + redirect rules
- [src/models/user.ts](src/models/user.ts) — schema with `telegram`, `telegramLinkCode`, `notificationPreferences`, `welcomeEmailSentAt`

## Key entrypoints
1. [src/lib/auth.ts:158](src/lib/auth.ts:158) — `localAuth()` / `auth()` dispatch
2. [src/middleware.ts:7](src/middleware.ts:7) — auto-login + redirect logic
3. [src/app/api/register/route.ts:12](src/app/api/register/route.ts:12) — bcryptjs hash + first-user admin
4. [src/lib/auth/local.ts:29](src/lib/auth/local.ts:29) — `validateAuthToken()` (timing-safe)
5. [src/app/api/telegram/link/route.ts:47](src/app/api/telegram/link/route.ts:47) — link-code mint
6. [src/app/(auth)/login/login-form.tsx:55](src/app/(auth)/login/login-form.tsx:55) — Google button (conditional render)

## Module-specific conventions
- **Session shape (both modes identical)**: `{ user: { id, email, name, image, role }, expires }`
- **Cookie names**: advanced → NextAuth default (`next-auth.session-token`); local → `sub5tr4cker-local-auth`
- **Local-mode user id**: hardcoded `LOCAL_ADMIN_USER_ID = "local-admin"`. Only one user. Single-tenant by design.
- **Token persistence (local)**: 32-byte random hex written to `~/.sub5tr4cker/config.json` and re-read into `SUB5TR4CKER_AUTH_TOKEN` env on `s54r start`. Middleware auto-sets cookie if missing.
- **Telegram link**: `POST /api/telegram/link` mints an 8-byte code with 15-min expiry; bot `/start link_<code>` calls the adapter's `linkTelegramAccountWithLinkCode()` which is atomic.
- **Password hashing**: bcryptjs v3 with cost factor 12.
- **Middleware matcher**: `["/", "/login", "/register", "/dashboard/:path*", "/api/:path*"]`

## Cross-cutting
- Every protected route does `const session = await auth(); if (!session?.user?.id) return 401`
- `MongoDBAdapter` requires `mongodb@^6` as a peer (kept as direct dep)
- The session callback hits the DB on every `auth()` call in advanced mode — beware N+1 in long route chains

## Gotchas
- **Sessions don't auto-refresh.** JWT `maxAge` is a 30-day hard cap; there is no rolling-window logic. Any "session not persistent" complaint is *not* immediate logout — it's the absolute 30-day expiry. Browsers sometimes evict the session cookie under storage pressure or 3rd-party cookie rules; that looks identical to expiry to the user. Worth investigating cookie persistence (httpOnly + sameSite + secure flags) before assuming expiry.
- **Google provider is conditional.** Only registered if **both** env vars are set; empty strings will register a broken provider. Add an explicit guard if you wire it up.
- **No OIDC support today.** Migrating to an external IdP (e.g. n450s_auth) means replacing both providers and the `MongoDBAdapter`; magic-invite tokens would need a shim or removal. Local mode would be unaffected (it bypasses NextAuth entirely).
- **Local mode token never expires** as long as `SUB5TR4CKER_AUTH_TOKEN` is set — rotate via CLI or restart.
- **`session()` callback hits DB.** Repeated `auth()` calls in the same request → repeated `store.getUser()`. Cache the session in route handlers if you need it more than once.
- **Welcome email + first-user-admin**: `POST /api/register` promotes the very first user to admin; subsequent users default to `role: "user"`.

## Related modules
- `see-ref-storage` — `getUser`, `getUserByEmail`, `updateUser`, `linkTelegramAccountWithLinkCode`
- `see-ref-notifications` — Telegram chatId is the bridge for non-email users

## Updating this ref
If session refresh, OIDC, or a new provider lands, replace the relevant Gotcha bullet with the new behavior and link the file:line.
