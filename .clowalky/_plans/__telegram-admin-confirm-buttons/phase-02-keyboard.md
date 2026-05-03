# Phase 2 — Build per-member admin keyboard

## Goal
Build the inline-keyboard helper that the admin Telegram message will use. One row per unverified member, two buttons per row: "✅ Confirm" and "✕ Reject". A trailing row with "✅ Confirm all" and "Open in dashboard".

## Scope
- Update `src/lib/telegram/keyboards.ts`:
  - Replace or extend `adminVerificationKeyboard()` with a function that takes `{ groupId, periodId, unverifiedMembers: Array<{ memberId, nickname }> }` and returns an `InlineKeyboardMarkup`.
  - Per-member row: `✅ {firstName}` with `callback_data = admin_confirm:<periodId>:<memberId>`, and `✕` with `callback_data = admin_reject:<periodId>:<memberId>`. Use `firstName` because callback_data has a 64-byte budget — we have room, but the *button label* is what matters for compactness; full nickname OK if short.
  - Trailing row: `✅ Confirm all (N)` with `callback_data = admin_confirm_all:<periodId>`, and `🔗 Open` with `url = ${appUrl}/dashboard/groups/<groupId>/billing`.
  - Validate every callback_data string is ≤ 64 bytes; truncate or hash long member ids if needed (Mongo ObjectIds are 24 chars, so prefix `admin_confirm:` + 24 + `:` + 24 = 63 bytes — exactly at the budget; build a unit test that asserts this).
  - If `unverifiedMembers.length > 8`, fall back to a single "Open dashboard" button (Telegram caps inline keyboards practically; avoid a wall of buttons).

## Scope OUT
- Wiring into `sendAdminConfirmationNudge` — phase 3.
- Handler implementations — phases 4–5.

## Files to touch
- `src/lib/telegram/keyboards.ts`
- `src/lib/telegram/keyboards.test.ts` (new — covers callback_data length + fallback)

## Acceptance criteria
- [ ] Helper returns the expected structure for 1, 3, and 9 members.
- [ ] No callback_data ever exceeds 64 bytes (test asserts).
- [ ] When >8 members, only the "Open dashboard" button is rendered.

## Manual verification
- `pnpm test -- src/lib/telegram/keyboards` green.
- `pnpm lint` clean.
