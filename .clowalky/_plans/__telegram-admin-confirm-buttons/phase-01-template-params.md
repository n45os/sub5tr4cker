# Phase 1 — Add `memberConfirmedAt` to admin nudge template params

## Goal
The admin needs to see *who* declared paid and *when*. Today the template only shows nickname + amount. Surface the `memberConfirmedAt` timestamp so the admin can prioritise (e.g. "Alice declared paid 2 hours ago, Bob is still pending").

## Scope
- Update the data passed to `sendAdminConfirmationNudge()` to include `memberConfirmedAt` per unverified member. The data source is `BillingPeriod.payments[i].memberConfirmedAt` — populate it when assembling `unverifiedMembers`.
- Update `buildAdminFollowUpTelegramText()` in `src/lib/email/templates/admin-follow-up.ts` to render a relative timestamp ("2h ago") next to each member name.
- Mirror the change in the email template `buildAdminFollowUpEmailHtml()`.
- Use a small util for "X minutes/hours/days ago" — write it inline if there isn't one (don't add a new dep).

## Scope OUT
- Inline keyboard wiring — phases 2–3.

## Files to touch
- `src/lib/notifications/admin-nudge.ts`
- `src/lib/email/templates/admin-follow-up.ts`

## Acceptance criteria
- [ ] Email + Telegram messages both show "<member> · €<amount> · <relative time>" per unverified member.
- [ ] Members with `memberConfirmedAt = null` show "(self-confirm pending)" instead of a timestamp.
- [ ] Existing tests for these templates still pass.

## Manual verification
- Trigger an admin nudge in dev (member self-confirms a payment) → check the Telegram message + the corresponding email show the new info.
- `pnpm lint` clean; `pnpm test` green.
