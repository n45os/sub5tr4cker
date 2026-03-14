import { buildEmailFooterHtml } from "@/lib/email/footer";

export interface AdminFollowUpTemplateParams {
  groupName: string;
  periodLabel: string;
  currency: string;
  unverifiedMembers: Array<{
    memberNickname: string;
    amount: number;
  }>;
}

export const adminFollowUpSampleParams: AdminFollowUpTemplateParams = {
  groupName: "Family YouTube Premium",
  periodLabel: "Mar 2026",
  currency: "EUR",
  unverifiedMembers: [
    { memberNickname: "Alex", amount: 4.99 },
    { memberNickname: "Sofia", amount: 4.99 },
  ],
};

export function buildAdminFollowUpEmailHtml(
  params: AdminFollowUpTemplateParams
): string {
  const memberList = params.unverifiedMembers
    .map(
      (member) =>
        `• ${member.memberNickname} — ${member.amount.toFixed(2)}${params.currency}`
    )
    .join("\n");

  return `
    <p>Hi,</p>
    <p>The following members say they've paid for <strong>${params.groupName}</strong> — ${params.periodLabel}:</p>
    <pre>${memberList}</pre>
    <p>Please verify their payments in the dashboard.</p>
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
      ${buildEmailFooterHtml({})}
    </div>
  `;
}

export function buildAdminFollowUpTelegramText(
  params: AdminFollowUpTemplateParams
): string {
  return (
    `📋 <b>Payments awaiting your verification</b>\n\n` +
    `<b>${params.groupName}</b> — ${params.periodLabel}\n\n` +
    params.unverifiedMembers
      .map(
        (member) =>
          `• ${member.memberNickname} — ${member.amount.toFixed(2)}${params.currency}`
      )
      .join("\n")
  );
}
