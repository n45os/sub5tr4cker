# Phase 3 — Wire keyboard into `sendAdminConfirmationNudge`

## Goal
Hook the keyboard from phase 2 into the actual Telegram send path so admins see the buttons.

## Scope
- Update `src/lib/telegram/send.ts:sendAdminConfirmationRequest()` (or whatever helper actually calls `bot.api.sendMessage` for the admin nudge) to accept an optional `replyMarkup` parameter and pass it through.
- Update `src/lib/notifications/admin-nudge.ts:sendAdminConfirmationNudge()` to:
  1. Build `unverifiedMembers` (already does, post phase 1).
  2. Call the new `adminVerificationKeyboard(...)` helper.
  3. Pass the resulting `InlineKeyboardMarkup` to the Telegram send helper.
- Email path is **not** changed — emails still use the existing CTA link.

## Scope OUT
- Handler logic — phases 4–5.

## Files to touch
- `src/lib/telegram/send.ts`
- `src/lib/notifications/admin-nudge.ts`

## Acceptance criteria
- [ ] When the worker dispatches an `admin_confirmation_request` task, the Telegram message arrives with inline buttons.
- [ ] Email arrives unchanged.

## Manual verification
- Trigger a self-confirm in dev → wait for the worker → check Telegram for buttons.
- `pnpm lint` clean; `pnpm test` green.
