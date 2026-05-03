# Phase 0 — Findings: current admin-nudge wiring

Read-only audit. Verifies the claims in `see-ref-notifications` against the
code on `main` so phases 1–5 can be designed from this document alone.

## Claim 1 — `sendAdminConfirmationNudge()` builds plain text with no inline keyboard

**Confirmed.** [src/lib/notifications/admin-nudge.ts:20-87](../../src/lib/notifications/admin-nudge.ts).

Trace:

- Line 53: `const telegramText = buildAdminFollowUpTelegramText(templateParams);` — builds a string only.
- Line 67-86: payload to `sendNotification(...)` carries `telegramText` but **no keyboard / reply markup field**.
- The `sendNotification(...)` payload type does not include a Telegram keyboard at all in this call site, so the admin gets a plain HTML message.
- `buildAdminFollowUpTelegramText()` itself returns a single `string` and has no awareness of inline keyboards ([src/lib/email/templates/admin-follow-up.ts:69-82](../../src/lib/email/templates/admin-follow-up.ts)).

The `sendAdminConfirmationRequest()` helper in [src/lib/telegram/send.ts:64-80](../../src/lib/telegram/send.ts) **does** accept a `keyboard: InlineKeyboard` argument and would attach it, but **nothing in the admin-nudge path calls it** — it is only used by other code paths (member-self-confirm). So the helper is not the gap; the gap is in `sendAdminConfirmationNudge()` not building/attaching a keyboard.

## Claim 2 — `adminVerificationKeyboard()` exists in `keyboards.ts` but is unused on this path

**Confirmed.** [src/lib/telegram/keyboards.ts:18-26](../../src/lib/telegram/keyboards.ts):

```ts
export function adminVerificationKeyboard(periodId: string, memberId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Confirm", `admin_confirm:${periodId}:${memberId}`)
    .text("Reject",  `admin_reject:${periodId}:${memberId}`);
}
```

A repo-wide grep for `adminVerificationKeyboard(` returns only its definition — no callers. The admin-nudge worker path never imports it.

### Callback_data size for our worst-case ids

- `admin_confirm:<periodId>:<memberId>` — prefix `admin_confirm:` is **14 bytes**; each ObjectId is **24 bytes**; two ObjectIds + one separator add **49 bytes**. **Total: 63 bytes — fits in 64 with 1 byte of slack.**
- `admin_reject:<periodId>:<memberId>` — prefix is **13 bytes**, total **62 bytes**.
- Cuid2 ids in local mode are also 24 chars, so the budget is identical.

A future "Confirm all" bulk button **cannot** carry a list of payment ids in the callback — even a single extra 24-char id would blow the 64-byte limit. Bulk confirm must encode only the period id (e.g. `admin_confirm_all:<periodId>` = 17 + 24 = 41 bytes) and re-derive the member set on the server from `payment.status === "member_confirmed"`.

## Claim 3 — `handleAdminConfirm()` and `handleAdminReject()` are wired and ready

**Confirmed.** [src/lib/telegram/handlers.ts](../../src/lib/telegram/handlers.ts):

- Dispatcher at lines 136-166 routes `admin_confirm` and `admin_reject` actions, given any callback_data with `≥3` colon-separated parts where parts[0] is the action.
- `handleAdminConfirm` (lines 255-284): looks up period + payment, calls `store.updatePaymentStatus(periodId, memberId, { status: "confirmed", adminConfirmedAt: new Date() })`, then `editMessageText` to overwrite the original message with a confirmation line.
- `handleAdminReject` (lines 286-314): flips status back to `pending` and clears `memberConfirmedAt`. Also `editMessageText`'s the original message.

Neither handler currently filters on the prior status (e.g. they would happily "confirm" a `pending` payment if a stale callback fired). This is a behavioural gap to consider in phase 4 / 5, but does not block wiring the buttons.

## Other questions called out in the brief

### Does the admin's Telegram message include who declared paid + when?

**Partially.** The text built by `buildAdminFollowUpTelegramText()` lists `memberNickname` + `amount` per row. **It does NOT include the `memberConfirmedAt` timestamp** — the template params type (`AdminFollowUpTemplateParams`) does not even carry it. The ref's claim is correct. Adding the timestamp requires:
1. Plumbing `memberConfirmedAt` through `unverifiedMembers[]` in `sendAdminConfirmationNudge()` (phase 1 work — the timestamp is already on each `payment` object before the filter).
2. Extending `AdminFollowUpTemplateParams` and the renderers.

### Is the nudge sent once per period per day, or once per (period, member)?

**Once per (group, period, day).** [src/lib/tasks/idempotency.ts:18-19](../../src/lib/tasks/idempotency.ts):

```ts
case "admin_confirmation_request":
  return `admin_confirmation_request:${payload.groupId}:${payload.billingPeriodId}:${day}`;
```

The dedupe key intentionally **ignores `memberId`**. Consequences:

- If 3 members all self-confirm on the same day, the admin gets **one** Telegram message that lists all 3.
- Therefore the keyboard cannot be a single `(periodId, memberId)` pair — it has to be either:
  - one row of `Confirm | Reject` per member (multi-row keyboard), each row carrying its own `memberId`, OR
  - per-member rows + an extra "Confirm all" button.
- The enqueue from `handleMemberConfirm` ([src/lib/telegram/handlers.ts:206-214](../../src/lib/telegram/handlers.ts)) and from `executeTask` ([src/lib/tasks/worker.ts:99-112](../../src/lib/tasks/worker.ts)) both pass `(groupId, billingPeriodId)` only — no `memberId` in the payload — confirming the dedupe scope. The nudge handler then re-derives the unverified set inside `sendAdminConfirmationNudge()` by filtering `period.payments` for `status === "member_confirmed"`. Phase 2's keyboard should follow the same derivation so it stays in sync with the message body.

### Telegram message-size considerations

- Telegram inline keyboards: max **100 buttons total** and each row up to **8 buttons**. For our use case (per-member `Confirm | Reject` rows + optional `Confirm all`) we are nowhere near limits even for very large groups.
- Each `callback_data` field is hard-capped at **64 bytes** — see size accounting above. Per-member rows fit; bulk-confirm must omit the member id.
- After `handleAdminConfirm` / `handleAdminReject` calls `editMessageText`, the **inline keyboard is dropped** unless `editMessageReplyMarkup` is also called. With per-member rows, partially handling one member would currently wipe the whole keyboard. Phase 4 / 5 will need to either:
  - rebuild the remaining keyboard via `editMessageReplyMarkup` after each action, OR
  - replace `editMessageText` with `editMessageReplyMarkup` so the body text stays put and only the row for the actioned member is updated.

## Notes / contradictions with `see-ref-notifications`

No contradictions found. All three Gotchas in the ref (lines 78-80) are accurate:
- admin Telegram nudge has no inline keyboard today — confirmed
- `memberConfirmedAt` not carried in template params — confirmed
- daily dedupe by `(groupId, periodId)` only — confirmed, with the additional concrete consequence that bulk-confirm callback_data cannot encode a member id list

Once phases 1–5 land and the keyboard ships, `see-ref-notifications` Gotchas (lines 78-80) should be replaced with a "now sends inline `Confirm | Reject` buttons per member, plus `Confirm all`" note — already foreshadowed at line 90 of the ref.
