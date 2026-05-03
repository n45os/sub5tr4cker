import { buildEmailShell } from "@/lib/email/layout";

export interface AdminFollowUpTemplateParams {
  groupName: string;
  periodLabel: string;
  currency: string;
  unverifiedMembers: Array<{
    memberNickname: string;
    amount: number;
    // accepts Date when called fresh, string when rehydrated from persisted emailParams JSON
    memberConfirmedAt: Date | string | null;
  }>;
  dashboardUrl?: string | null;
  /** optional; kept for consistency */
  accentColor?: string | null;
  theme?: string | null;
}

export const adminFollowUpSampleParams: AdminFollowUpTemplateParams = {
  groupName: "Family YouTube Premium",
  periodLabel: "Mar 2026",
  currency: "EUR",
  unverifiedMembers: [
    {
      memberNickname: "Alex",
      amount: 4.99,
      memberConfirmedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      memberNickname: "Sofia",
      amount: 4.99,
      memberConfirmedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  ],
  dashboardUrl: "https://substrack.example.com/dashboard/groups/group-1/billing",
};

const PENDING_LABEL = "(self-confirm pending)";

function formatRelativeTime(value: Date | string | null): string {
  if (value === null || value === undefined) return PENDING_LABEL;
  const ts = typeof value === "string" ? new Date(value) : value;
  const ms = ts.getTime();
  if (Number.isNaN(ms)) return PENDING_LABEL;
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function buildAdminFollowUpEmailHtml(
  params: AdminFollowUpTemplateParams
): string {
  const totalAmount = params.unverifiedMembers.reduce(
    (sum, member) => sum + member.amount,
    0
  );
  const rows = params.unverifiedMembers
    .map(
      (member) => `
        <div class="row">
          <span class="label">${member.memberNickname} · ${formatRelativeTime(member.memberConfirmedAt)}</span>
          <span class="value">${params.currency} ${member.amount.toFixed(2)}</span>
        </div>
      `
    )
    .join("");
  const bodyHtml = `
    <p>The following members marked payment as completed for <strong>${params.groupName}</strong> — ${params.periodLabel}.</p>
    <div class="summary-card">
      <p class="kicker">Awaiting admin verification</p>
      <p class="amount">${params.currency} ${totalAmount.toFixed(2)}</p>
      <p class="muted">${params.unverifiedMembers.length} member(s) pending</p>
      <div class="rows">${rows}</div>
    </div>
    <p>Please verify these payments in the dashboard.</p>
    ${params.dashboardUrl ? `
      <div class="cta">
        <a href="${params.dashboardUrl}" class="btn">Verify in dashboard</a>
      </div>
    ` : ""}
  `;

  return buildEmailShell({
    title: "Payments Awaiting Verification",
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null,
  });
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
          `• ${member.memberNickname} · ${member.amount.toFixed(2)}${params.currency} · ${formatRelativeTime(member.memberConfirmedAt)}`
      )
      .join("\n")
  );
}
