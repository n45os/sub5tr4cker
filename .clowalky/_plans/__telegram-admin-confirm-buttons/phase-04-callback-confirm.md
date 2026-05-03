# Phase 4 — Confirm callback handler — single-payment path

## Goal
Make the per-member ✅ button actually flip a payment from `member_confirmed` to `confirmed`, edit the original Telegram message to reflect the change, and post a brief confirmation toast via `answerCallbackQuery`.

## Scope
- In `src/lib/telegram/handlers.ts:handleAdminConfirm()`:
  - Parse `callback_data = admin_confirm:<periodId>:<memberId>` (validate prefix + length).
  - Verify the Telegram user is the group admin — look up the user by `chatId`, then load the group, then assert `group.adminId === user._id`. If not, `answerCallbackQuery({ text: "Not authorized", show_alert: true })` and bail.
  - Call the same internal helper used by `POST /api/groups/[groupId]/billing/[periodId]/confirm` (extract it into `src/lib/billing/admin-confirm.ts` if it lives inline in the route — keeps both paths identical).
  - On success: edit the original message via `editMessageText` to mark this member confirmed (e.g. strike-through their row, or remove their button row, depending on what reads best).
  - `answerCallbackQuery({ text: "Confirmed ✓" })`.
  - On payment-already-confirmed: still answer with "Already confirmed".
  - Audit: same `payment_confirmed` event the dashboard path emits.

## Scope OUT
- Reject + confirm-all — phase 5.

## Files to touch
- `src/lib/telegram/handlers.ts`
- `src/lib/billing/admin-confirm.ts` (new — extracted helper if needed)
- `src/app/api/groups/[groupId]/billing/[periodId]/confirm/route.ts` (refactor to use the new helper)

## Acceptance criteria
- [ ] Pressing ✅ updates the payment status in DB.
- [ ] The original Telegram message is edited to reflect the new state.
- [ ] Non-admin presses get a "Not authorized" toast and no DB change.
- [ ] Audit event recorded.

## Manual verification
- Reproduce the full flow: member self-confirms → admin gets nudge → admin presses ✅ → check DB shows `confirmed`.
- `pnpm lint` clean; `pnpm test` green.
