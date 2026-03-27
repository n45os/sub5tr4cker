import { buildEmailShell } from "@/lib/email/layout";
import { escapeTelegramHtml } from "@/lib/telegram/escape-html";

export interface AggregatedPaymentEntry {
  groupName: string;
  serviceName: string;
  periodLabel: string;
  amount: number;
  currency: string;
  paymentPlatform: string;
  paymentLink: string | null;
  paymentInstructions?: string | null;
  confirmUrl: string | null;
  adjustmentReason?: string | null;
  priceNote?: string | null;
  accentColor?: string | null;
  theme?: string | null;
}

export interface AggregatedPaymentReminderTemplateParams {
  memberName: string;
  entries: AggregatedPaymentEntry[];
  /** distinct groups represented in entries (entries.length can be multiple periods in one group) */
  distinctGroupCount: number;
  /** distinct billing periods represented in entries */
  distinctPeriodCount: number;
  /** optional; when set, footer includes unsubscribe link */
  unsubscribeUrl?: string | null;
  /** optional; hex accent for header and primary buttons (falls back to first entry or default) */
  accentColor?: string | null;
  /** optional; template style preset */
  theme?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAggregatedIntroText(
  distinctPeriodCount: number,
  distinctGroupCount: number
): string {
  if (distinctGroupCount <= 1) {
    return `You have unpaid amounts for ${distinctPeriodCount} billing period(s):`;
  }
  return `You have unpaid amounts for ${distinctPeriodCount} billing period(s) across ${distinctGroupCount} subscription groups:`;
}

export function buildAggregatedPaymentReminderEmailHtml(
  params: AggregatedPaymentReminderTemplateParams
): string {
  const totalAmount = params.entries.reduce((sum, e) => sum + e.amount, 0);
  const currency = params.entries[0]?.currency ?? "€";

  const sectionsHtml = params.entries
    .map((entry) => {
      const note =
        entry.adjustmentReason || entry.priceNote
          ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 12px 0; font-size: 13px; color: #78350f;">
              <strong>Note:</strong> ${escapeHtml(entry.adjustmentReason || entry.priceNote || "")}
            </div>`
          : "";
      const payBtn = entry.paymentLink
        ? `<div style="text-align: center; margin: 16px 0;">
             <a href="${escapeHtml(entry.paymentLink)}" class="btn">Pay now</a>
           </div>`
        : "";
      const confirmBtn = entry.confirmUrl
        ? `<div style="text-align: center; margin: 16px 0;">
             <a href="${escapeHtml(entry.confirmUrl)}" class="btn btn-confirm">Verify payment</a>
           </div>`
        : "";
      return `
        <div class="section-card" style="border-left: 4px solid ${entry.accentColor || "#3b82f6"};">
          <p class="kicker">${escapeHtml(entry.serviceName)}</p>
          <p style="margin: 0 0 4px; font-weight: 600;">${escapeHtml(entry.groupName)} — ${escapeHtml(entry.periodLabel)}</p>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${entry.currency} ${entry.amount.toFixed(2)}</p>
          <div class="rows">
            <div class="row">
              <span class="label">Method</span>
              <span class="value" style="text-transform: capitalize;">${escapeHtml(entry.paymentPlatform.replaceAll("_", " "))}</span>
            </div>
            ${entry.paymentInstructions ? `
              <div class="row">
                <span class="label">Instructions</span>
                <span class="value">${escapeHtml(entry.paymentInstructions)}</span>
              </div>
            ` : ""}
          </div>
          ${note}
          ${payBtn}
          ${confirmBtn}
        </div>`;
    })
    .join("");

  const bodyHtml = `
    <p>Hi ${escapeHtml(params.memberName)},</p>
    <p>${escapeHtml(buildAggregatedIntroText(params.distinctPeriodCount, params.distinctGroupCount))}</p>
    <div class="summary-card">
      <p class="kicker">Total due</p>
      <p class="amount">${currency} ${totalAmount.toFixed(2)}</p>
      <p class="muted">${params.distinctPeriodCount} period(s) · ${params.distinctGroupCount} group(s)</p>
    </div>
    ${sectionsHtml}
    <p class="muted">Use the verify button after each transfer so the admin can approve it.</p>
  `;

  return buildEmailShell({
    title: "Payment Reminders",
    bodyHtml,
    accentColor: params.accentColor ?? params.entries[0]?.accentColor ?? null,
    theme: params.theme ?? params.entries[0]?.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null,
  });
}

export function buildAggregatedPaymentReminderTelegramText(
  params: Pick<
    AggregatedPaymentReminderTemplateParams,
    "memberName" | "entries" | "distinctGroupCount" | "distinctPeriodCount"
  >
): string {
  const totalAmount = params.entries.reduce((sum, e) => sum + e.amount, 0);
  const currency = params.entries[0]?.currency ?? "€";
  const intro = buildAggregatedIntroText(
    params.distinctPeriodCount,
    params.distinctGroupCount
  );
  const introSafe = escapeTelegramHtml(intro.replace(/^You have /, "you have "));
  const nameSafe = escapeTelegramHtml(params.memberName);
  const currencySafe = escapeTelegramHtml(currency);
  const lines: string[] = [
    "💳 <b>Payment Reminders</b>",
    "",
    `${nameSafe}, ${introSafe}`,
    `<b>Total: ${totalAmount.toFixed(2)}${currencySafe}</b>`,
    "",
  ];
  for (const entry of params.entries) {
    const gn = escapeTelegramHtml(entry.groupName);
    const pl = escapeTelegramHtml(entry.periodLabel);
    const cur = escapeTelegramHtml(entry.currency);
    const noteRaw = entry.adjustmentReason || entry.priceNote;
    const note =
      noteRaw != null && noteRaw !== ""
        ? `\n⚠️ <i>${escapeTelegramHtml(noteRaw)}</i>`
        : "";
    lines.push(
      `• <b>${gn}</b> — ${pl}: ${entry.amount.toFixed(2)}${cur}${note}`
    );
    if (entry.paymentLink) {
      lines.push(`  Pay: ${escapeTelegramHtml(entry.paymentLink)}`);
    }
  }
  lines.push("", "Tap below to verify payment once paid (per group).");
  return lines.join("\n");
}
