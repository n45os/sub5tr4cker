import { buildEmailFooterHtml } from "@/lib/email/footer";
import { getAccentColor, buildAutomatedMessageBadgeHtml } from "@/lib/email/branding";

export interface PriceAdjustmentTemplateParams {
  memberName: string;
  groupName: string;
  periodLabel: string;
  originalAmount: number;
  newAmount: number;
  difference: number;
  currency: string;
  reason: string;
  paymentLink: string | null;
  confirmUrl: string | null;
  /** when true, difference is a credit (reduces next payment) rather than amount due */
  isCredit?: boolean;
  unsubscribeUrl?: string | null;
  accentColor?: string | null;
}

export function buildPriceAdjustmentEmailHtml(
  params: PriceAdjustmentTemplateParams,
): string {
  const accent = getAccentColor(params.accentColor);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { background: ${accent}; color: #fff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .body { padding: 24px; }
        .amount-box { text-align: center; margin: 20px 0; padding: 16px; background: #fef3c7; border-radius: 8px; }
        .amount { font-size: 24px; font-weight: bold; color: #1e293b; }
        .diff { font-size: 14px; color: #92400e; margin-top: 8px; }
        .reason { background: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-size: 13px; color: #78350f; }
        .btn { display: inline-block; background: ${accent}; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; }
        .btn-confirm { background: #22c55e; }
        .footer { padding: 16px 24px; background: #f8fafc; color: #94a3b8; font-size: 12px; text-align: center; }
        .cta { text-align: center; margin: 24px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        ${buildAutomatedMessageBadgeHtml()}
        <div class="header">
          <h1>Price Adjustment</h1>
        </div>
        <div class="body">
          <p>Hi ${params.memberName},</p>
          <p>The price for <strong>${params.groupName}</strong> has been adjusted for ${params.periodLabel}.</p>
          <div class="amount-box">
            <div class="amount">${params.isCredit ? "Credit: " : "Difference: "}${params.difference.toFixed(2)}${params.currency}</div>
            <div class="diff">
              Previous: ${params.originalAmount.toFixed(2)}${params.currency} →
              New: ${params.newAmount.toFixed(2)}${params.currency}
            </div>
          </div>
          <div class="reason">
            <strong>Reason:</strong> ${params.reason}
          </div>
          <p>${params.difference === 0
            ? `Your share for the next period is <strong>${params.newAmount.toFixed(2)}${params.currency}</strong>.`
            : params.isCredit
              ? `This amount will be credited to your next payment. Your next payment is <strong>${params.newAmount.toFixed(2)}${params.currency}</strong> or less.`
              : `Please pay the difference of <strong>${params.difference.toFixed(2)}${params.currency}</strong>.`}</p>
          ${params.paymentLink ? `
            <div class="cta">
              <a href="${params.paymentLink}" class="btn">Pay difference</a>
            </div>
          ` : ""}
          ${params.confirmUrl ? `
            <div class="cta">
              <a href="${params.confirmUrl}" class="btn btn-confirm">I've Paid</a>
            </div>
          ` : ""}
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

export function buildPriceAdjustmentTelegramText(
  params: Pick<
    PriceAdjustmentTemplateParams,
    "memberName" | "groupName" | "periodLabel" | "originalAmount" | "newAmount" | "difference" | "currency" | "reason" | "paymentLink" | "isCredit"
  >,
): string {
  const creditNote =
    params.difference === 0
      ? `Your share for the next period is ${params.newAmount.toFixed(2)}${params.currency}.`
      : params.isCredit
        ? `This amount will be credited to your next payment.`
        : `Please pay the difference and confirm.`;
  const diffLine =
    params.difference === 0
      ? ""
      : `\n${params.isCredit ? "Credit: " : "Difference: "}<b>${params.difference.toFixed(2)}${params.currency}</b>\n\n`;
  return (
    `⚠️ <b>Price Adjustment</b>\n\n` +
    `${params.memberName}, the price for <b>${params.groupName}</b> — ${params.periodLabel} has changed.\n\n` +
    `Previous: <s>${params.originalAmount.toFixed(2)}${params.currency}</s>\n` +
    `New: <b>${params.newAmount.toFixed(2)}${params.currency}</b>${diffLine}` +
    `<i>${params.reason}</i>\n\n` +
    (params.paymentLink ? `Pay: ${params.paymentLink}\n\n` : "") +
    creditNote
  );
}
