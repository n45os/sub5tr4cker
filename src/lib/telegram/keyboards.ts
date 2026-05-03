import { InlineKeyboard } from "grammy";

import { normalizeAppUrl } from "@/lib/public-app-url";

// payment confirmation keyboard shown to members
export function paymentConfirmationKeyboard(
  periodId: string,
  memberId: string,
  options?: { includePayDetails?: boolean }
): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("I've Paid", `confirm:${periodId}:${memberId}`)
    .text("Remind Later", `snooze:${periodId}:${memberId}`);
  if (options?.includePayDetails !== false) {
    kb.row().text("Show paying details", `paydetails:${periodId}:${memberId}`);
  }
  return kb;
}

export type AdminConfirmationMember = {
  memberId: string;
  nickname: string;
};

export type AdminVerificationKeyboardParams = {
  groupId: string;
  periodId: string;
  unverifiedMembers: AdminConfirmationMember[];
  appUrl: string | null | undefined;
};

// telegram caps inline keyboards practically; above this we fall back to a single link
const MAX_PER_MEMBER_ROWS = 8;

// admin verification keyboard for the unverified-members nudge
export function adminVerificationKeyboard(
  params: AdminVerificationKeyboardParams
): InlineKeyboard {
  const { groupId, periodId, unverifiedMembers, appUrl } = params;
  const normalized = normalizeAppUrl(appUrl);
  const dashboardUrl = normalized
    ? `${normalized}/dashboard/groups/${groupId}/billing`
    : null;

  if (unverifiedMembers.length > MAX_PER_MEMBER_ROWS) {
    const kb = new InlineKeyboard();
    if (dashboardUrl) {
      kb.url("Open dashboard", dashboardUrl);
    }
    return kb;
  }

  const kb = new InlineKeyboard();
  for (const member of unverifiedMembers) {
    const label = buildConfirmLabel(member.nickname);
    kb.text(`✅ ${label}`, `admin_confirm:${periodId}:${member.memberId}`)
      .text("✕", `admin_reject:${periodId}:${member.memberId}`)
      .row();
  }

  kb.text(
    `✅ Confirm all (${unverifiedMembers.length})`,
    `admin_confirm_all:${periodId}`
  );
  if (dashboardUrl) {
    kb.url("🔗 Open", dashboardUrl);
  }
  return kb;
}

function buildConfirmLabel(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return "member";
  const firstName = trimmed.split(/\s+/)[0] ?? trimmed;
  return firstName.length > 24 ? `${firstName.slice(0, 23)}…` : firstName;
}

// generic yes/no keyboard
export function yesNoKeyboard(actionPrefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Yes", `${actionPrefix}:yes`)
    .text("No", `${actionPrefix}:no`);
}
