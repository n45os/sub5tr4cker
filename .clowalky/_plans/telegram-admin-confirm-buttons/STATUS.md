| ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
|----|-------|--------|------------|-------|---------|-----------|-------|
| 0 | Confirm current Telegram admin nudge wiring | complete | — | phase-00-current-wiring.md | 2026-05-03 | 2026-05-03 | read-only investigation; ref claims all confirmed |
| 1 | Add `memberConfirmedAt` to admin nudge template params | complete | 0 | phase-01-template-params.md | 2026-05-03 | 2026-05-03 | |
| 2 | Build per-member admin keyboard | complete | 1 | phase-02-keyboard.md | 2026-05-03 | 2026-05-03 | |
| 3 | Wire keyboard into `sendAdminConfirmationNudge` | pending | 2 | phase-03-wire-nudge.md | | | |
| 4 | Confirm callback handler — single-payment confirm path | pending | 3 | phase-04-callback-confirm.md | | | |
| 5 | Reject callback handler + confirm-all button | pending | 3 | phase-05-callback-reject-and-bulk.md | | | parallel with 4 if separate files |
| 6 | Tests + Telegram bot integration smoke | pending | 4,5 | phase-06-tests.md | | | |
