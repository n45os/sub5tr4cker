# Phase 5 — Reject + confirm-all callback handlers

## Goal
Wire the ✕ Reject button and the "Confirm all (N)" button. Reject takes the payment back to `pending` and sends the member a "Your payment was rejected — please re-confirm" message. Confirm-all is the per-period equivalent of phase 4 for every `member_confirmed` payment in one tap.

## Scope
- In `src/lib/telegram/handlers.ts:handleAdminReject()`:
  - Parse `admin_reject:<periodId>:<memberId>`. Authorize. Update payment status `member_confirmed → pending`. Audit `payment_rejected`.
  - Edit the message similarly to phase 4 (mark this row "rejected").
  - Send the affected member a Telegram DM (if linked) or email saying their confirmation was rejected and please re-pay/confirm.
- New `handleAdminConfirmAll()`:
  - Parse `admin_confirm_all:<periodId>`. Authorize.
  - Load the period, walk `payments[]`, confirm every `member_confirmed` row using the same helper as phase 4.
  - Edit the message to "All N payments confirmed."
  - Audit one event per confirmed payment OR a single bulk audit event — pick the simpler path.
- Update the dispatcher in `handlers.ts` to route `admin_reject:` and `admin_confirm_all:` callbacks to the new handlers.

## Scope OUT
- Per-member reject reasons / dialog — keep it simple, no follow-up prompt.

## Files to touch
- `src/lib/telegram/handlers.ts`
- `src/lib/billing/admin-confirm.ts` (extend with `confirmAllMemberConfirmed(periodId)`)
- `src/lib/notifications/service.ts` (only if the rejected-member DM is a new notification type — otherwise reuse existing path)

## Acceptance criteria
- [ ] ✕ Reject flips `member_confirmed → pending` and notifies the member.
- [ ] "Confirm all (N)" confirms every member_confirmed payment in the period in one tap.
- [ ] Both paths edit the original message to reflect the new state.

## Manual verification
- Reject flow: member confirms → admin rejects → member receives the rejection notice.
- Confirm-all: three members confirm → admin presses Confirm all → all three flip to confirmed.
- `pnpm lint` clean; `pnpm test` green.
