import { InlineKeyboard } from "grammy";

// payment confirmation keyboard shown to members
export function paymentConfirmationKeyboard(
  periodId: string,
  memberId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("I've Paid", `confirm:${periodId}:${memberId}`)
    .text("Remind Later", `snooze:${periodId}:${memberId}`);
}

// admin verification keyboard shown when a member confirms
export function adminVerificationKeyboard(
  periodId: string,
  memberId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("Confirm", `admin_confirm:${periodId}:${memberId}`)
    .text("Reject", `admin_reject:${periodId}:${memberId}`);
}

// generic yes/no keyboard
export function yesNoKeyboard(actionPrefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Yes", `${actionPrefix}:yes`)
    .text("No", `${actionPrefix}:no`);
}
