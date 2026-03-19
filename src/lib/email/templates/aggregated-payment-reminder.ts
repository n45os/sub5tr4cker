import { buildEmailFooterHtml } from "@/lib/email/footer";
import {
  getAccentColor,
  buildAutomatedMessageBadgeHtml,
} from "@/lib/email/branding";

export interface AggregatedPaymentEntry {
  groupName: string;
  serviceName: string;
  periodLabel: string;
  amount: number;
  currency: string;
  paymentPlatform: string;
  paymentLink: string | null;
  confirmUrl: string | null;
  adjustmentReason?: string | null;
  priceNote?: string | null;
  accentColor?: string | null;
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
  const accent =
    params.accentColor ?? params.entries[0]?.accentColor ?? null;
  const accentStyle = getAccentColor(accent);

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
             <a href="${escapeHtml(entry.paymentLink)}" style="display: inline-block; background: ${accentStyle}; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">Pay via ${escapeHtml(entry.paymentPlatform)}</a>
           </div>`
        : "";
      const confirmBtn = entry.confirmUrl
        ? `<div style="text-align: center; margin: 16px 0;">
             <a href="${escapeHtml(entry.confirmUrl)}" style="display: inline-block; background: #22c55e; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">I've Paid</a>
           </div>`
        : "";
      return `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 8px; font-weight: 600;">${escapeHtml(entry.groupName)} — ${escapeHtml(entry.periodLabel)}</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1e293b;">${entry.amount.toFixed(2)}${entry.currency}</p>
          ${note}
          ${payBtn}
          ${confirmBtn}
        </div>`;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { background: ${accentStyle}; color: #fff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .body { padding: 24px; }
        .total { font-size: 24px; font-weight: bold; color: #1e293b; text-align: center; margin: 16px 0; padding: 16px; background: #f8fafc; border-radius: 8px; }
        .footer { padding: 16px 24px; background: #f8fafc; color: #94a3b8; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        ${buildAutomatedMessageBadgeHtml()}
        <div class="header">
          <h1>Payment Reminders</h1>
        </div>
        <div class="body">
          <p>Hi ${escapeHtml(params.memberName)},</p>
          <p>${escapeHtml(buildAggregatedIntroText(params.distinctPeriodCount, params.distinctGroupCount))}</p>
          <div class="total">Total: ${totalAmount.toFixed(2)}${currency}</div>
          ${sectionsHtml}
          <p>Thank you!</p>
        </div>
        <div class="footer">
          ${buildEmailFooterHtml({ unsubscribeUrl: params.unsubscribeUrl ?? null })}
        </div>
      </div>
    </body>
    </html>
  `;
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
  const lines: string[] = [
    "💳 <b>Payment Reminders</b>",
    "",
    `${params.memberName}, ${intro.replace(/^You have /, "you have ")}`,
    `<b>Total: ${totalAmount.toFixed(2)}${currency}</b>`,
    "",
  ];
  for (const entry of params.entries) {
    const note =
      entry.adjustmentReason || entry.priceNote
        ? `\n⚠️ <i>${entry.adjustmentReason || entry.priceNote}</i>`
        : "";
    lines.push(
      `• <b>${entry.groupName}</b> — ${entry.periodLabel}: ${entry.amount.toFixed(2)}${entry.currency}${note}`
    );
    if (entry.paymentLink) {
      lines.push(`  Pay: ${entry.paymentLink}`);
    }
  }
  lines.push("", "Tap below to confirm once paid (per group).");
  return lines.join("\n");
}
