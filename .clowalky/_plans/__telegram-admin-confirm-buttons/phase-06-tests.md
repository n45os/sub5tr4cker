# Phase 6 — Tests + Telegram bot integration smoke

## Goal
Lock the new Telegram admin-confirm flow with tests and a manual smoke walk against a real bot.

## Scope
- Unit tests:
  - `keyboards.test.ts` (extended) — verify keyboard shape for 1, 3, 9 members; assert callback_data length budget.
  - `handlers.test.ts` — exercise `handleAdminConfirm`, `handleAdminReject`, `handleAdminConfirmAll` with mocked grammy contexts and a fake storage adapter:
    - Authorized admin path → DB updated, `answerCallbackQuery` + `editMessageText` called.
    - Non-admin path → `answerCallbackQuery({ show_alert: true })`, no DB change.
    - Already-confirmed payment → "Already confirmed" toast.
    - Member self-confirm timestamp displayed in the message.
- Manual smoke:
  - Stand up sub5tr4cker in advanced mode against a test bot.
  - Member self-confirm → wait for worker → admin gets buttons.
  - Press ✅ → DB updates → message edits.
  - Press ✕ → DB reverts → member receives notice.
  - Press Confirm all → all flip.
  - Capture screenshots.
- Update CHANGELOG.md.

## Scope OUT
- E2E tests through real Telegram — too flaky for CI.

## Files to touch
- `src/lib/telegram/keyboards.test.ts`
- `src/lib/telegram/handlers.test.ts` (NEW or extended)
- `CHANGELOG.md`
- `.clowalky/_plans/telegram-admin-confirm-buttons/phase-06-results.md` + screenshots

## Acceptance criteria
- [ ] All unit tests pass.
- [ ] Manual smoke walk completed.
- [ ] CHANGELOG entry written.

## Manual verification
- See above.
