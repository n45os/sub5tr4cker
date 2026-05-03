# Phase 6 — Bulk confirm on billing matrix

## Goal
Stop forcing the admin to confirm payments one-at-a-time. Add a "Confirm all member-confirmed" button per period row (or per matrix), which calls the existing confirm endpoint in a loop and updates the UI optimistically.

## Scope
- In `src/components/features/billing/payment-matrix.tsx`, for each period row, render a "Confirm all (N)" pill in the header where N = count of payments in `member_confirmed` state. Disabled when N=0.
- On click: client component sends a serialized loop of `POST /api/groups/[groupId]/billing/[periodId]/confirm` calls (one per memberId), shows a toast with the running total, then revalidates the page.
- No new API endpoint — reuse what exists. If perf is a concern, add a `POST .../confirm` body that accepts an array of memberIds in a future phase (out of scope here).

## Scope OUT
- Multi-period bulk confirm (e.g. across an entire group).
- Server-side batch endpoint.

## Files to touch
- `src/components/features/billing/payment-matrix.tsx`
- `src/components/features/billing/bulk-confirm-button.tsx` (NEW client component)

## Acceptance criteria
- [ ] Each period header shows "Confirm all (N)" when there are member-confirmed payments.
- [ ] Clicking it confirms each one sequentially with a visible progress indicator.
- [ ] A failure mid-loop surfaces the error and stops; admin can retry.

## Manual verification
- `pnpm dev` → simulate three members declaring paid in one period → click "Confirm all (3)" → all three flip to confirmed.
- `pnpm lint` clean; `pnpm test` green.
