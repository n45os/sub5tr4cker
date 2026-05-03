| ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
|----|-------|--------|------------|-------|---------|-----------|-------|
| 0 | Confirm current Telegram admin nudge wiring | complete | — | phase-00-current-wiring.md | 2026-05-03 | 2026-05-03 | read-only investigation; ref claims all confirmed |
| 1 | Add `memberConfirmedAt` to admin nudge template params | complete | 0 | phase-01-template-params.md | 2026-05-03 | 2026-05-03 | |
| 2 | Build per-member admin keyboard | complete | 1 | phase-02-keyboard.md | 2026-05-03 | 2026-05-03 | |
| 3 | Wire keyboard into `sendAdminConfirmationNudge` | complete | 2 | phase-03-wire-nudge.md | 2026-05-03 | 2026-05-03 | keyboard wired via existing `telegramKeyboard` field on `sendNotification`; `send.ts:sendAdminConfirmationRequest` already accepted a keyboard and remains untouched |
| 4 | Confirm callback handler — single-payment confirm path | complete | 3 | phase-04-callback-confirm.md | 2026-05-03 | 2026-05-03 | extracted shared `applyAdminPaymentDecision` helper; route + tg callback now route through it |
| 5 | Reject callback handler + confirm-all button | complete | 3 | phase-05-callback-reject-and-bulk.md | 2026-05-03 | 2026-05-03 | reject reuses `applyAdminPaymentDecision` (action=reject); bulk confirm goes through new `confirmAllMemberConfirmed`; rejection DM/email reuses `payment_reminder` type |
| 6 | Tests + Telegram bot integration smoke | complete | 4,5 | phase-06-tests.md | 2026-05-03 | 2026-05-03 | unit suite green (102/102); manual TG smoke + screenshots deferred to operator (autonomous runner has no live bot/MongoDB/screen capture); see phase-06-results.md |
