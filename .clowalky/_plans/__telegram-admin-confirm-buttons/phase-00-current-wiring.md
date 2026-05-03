# Phase 0 — Confirm current Telegram admin nudge wiring

## Goal
Verify the actual state of the admin-confirmation Telegram message before changing anything. The notifications ref claims:
- `sendAdminConfirmationNudge()` builds plain text with no inline keyboard.
- `adminVerificationKeyboard()` exists in `keyboards.ts` but is unused in this path.
- `handleAdminConfirm()` and `handleAdminReject()` are wired and ready in `handlers.ts`.

Confirm each claim by reading the code, and record any nuance found (e.g. message size limits, callback_data length budget for multi-member periods).

## Scope
- READ-ONLY pass over:
  - `src/lib/notifications/admin-nudge.ts`
  - `src/lib/email/templates/admin-follow-up.ts` (the `buildAdminFollowUpTelegramText()` helper)
  - `src/lib/telegram/send.ts` (`sendAdminConfirmationRequest()`)
  - `src/lib/telegram/keyboards.ts`
  - `src/lib/telegram/handlers.ts` (`handleAdminConfirm`, `handleAdminReject`, dispatcher)
  - `src/lib/tasks/worker.ts` (where the nudge is invoked from `executeTask()`)
  - `src/lib/tasks/idempotency.ts` (admin nudge dedupe key)
- Write findings to `.clowalky/_plans/telegram-admin-confirm-buttons/phase-00-findings.md`. Specifically answer:
  - Exact callback_data shape currently returned by `adminVerificationKeyboard()` and whether it stays under 64 bytes for our worst-case ids (Mongo ObjectId 24 chars × 2 + prefix).
  - Whether the admin nudge is sent once per period per day (idempotency confirmed) or once per `(period, member)`.
  - Whether the admin's Telegram message currently includes the member who declared paid + when (or if the timestamp is missing as the ref claims).

## Scope OUT
- Code changes — phases 1+.

## Files to touch
- `.clowalky/_plans/telegram-admin-confirm-buttons/phase-00-findings.md`

## Acceptance criteria
- [ ] Findings file answers all three questions above with code citations.
- [ ] If anything contradicts the ref, the gotchas section in `see-ref-notifications` is flagged in `Notes`.

## Manual verification
- Read the findings file cold — it should be enough to design phases 1–5 from.
