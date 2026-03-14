import { buildEmailFooterHtml } from "@/lib/email/footer";
import { buildAutomatedMessageBadgeHtml } from "@/lib/email/branding";

export interface AdminFollowUpTemplateParams {
  groupName: string;
  periodLabel: string;
  currency: string;
  unverifiedMembers: Array<{
    memberNickname: string;
    amount: number;
  }>;
  /** optional; not used for this minimal template, kept for consistency */
  accentColor?: string | null;
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
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${buildAutomatedMessageBadgeHtml()}
      <div style="padding: 24px;">
        <p>Hi,</p>
        <p>The following members say they've paid for <strong>${params.groupName}</strong> — ${params.periodLabel}:</p>
        <pre>${memberList}</pre>
        <p>Please verify their payments in the dashboard.</p>
      </div>
      <div style="margin-top: 24px; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        ${buildEmailFooterHtml({})}
      </div>
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
