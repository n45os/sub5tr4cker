import { buildEmailFooterHtml } from "@/lib/email/footer";
import { getAccentColor, buildAutomatedMessageBadgeHtml } from "@/lib/email/branding";

export interface PaymentReminderTemplateParams {
  memberName: string;
  groupName: string;
  periodLabel: string;
  amount: number;
  currency: string;
  paymentPlatform: string;
  paymentLink: string | null;
  confirmUrl: string | null;
  ownerName: string;
  extraText: string | null;
  /** admin note explaining a price adjustment for this payment */
  adjustmentReason?: string | null;
  /** blanket admin note for the whole period */
  priceNote?: string | null;
  /** optional; when set, footer includes repo link and unsubscribe link */
  unsubscribeUrl?: string | null;
  /** optional; hex accent for header and primary buttons */
  accentColor?: string | null;
}

export const paymentReminderSampleParams: PaymentReminderTemplateParams = {
  memberName: "Alex",
  groupName: "Family YouTube Premium",
  periodLabel: "Mar 2026",
  amount: 4.99,
  currency: "EUR",
  paymentPlatform: "revolut",
  paymentLink: "https://revolut.me/example",
  confirmUrl: "https://example.com/api/confirm/example-token",
  ownerName: "Nassos",
  extraText: "Please pay before the end of the week so access stays uninterrupted.",
};

export function buildPaymentReminderEmailHtml(
  params: PaymentReminderTemplateParams
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
        .amount { font-size: 28px; font-weight: bold; color: #1e293b; text-align: center; margin: 20px 0; }
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
          <h1>Payment Reminder</h1>
        </div>
        <div class="body">
          <p>Hi ${params.memberName},</p>
          <p>You owe for <strong>${params.groupName}</strong> — ${params.periodLabel}:</p>
          <div class="amount">${params.amount.toFixed(2)}${params.currency}</div>
          ${(params.adjustmentReason || params.priceNote) ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-size: 13px; color: #78350f;">
              <strong>Note:</strong> ${params.adjustmentReason || params.priceNote}
            </div>
          ` : ""}
          ${params.paymentLink ? `
            <div class="cta">
              <a href="${params.paymentLink}" class="btn">Pay via ${params.paymentPlatform}</a>
            </div>
          ` : ""}
          ${params.confirmUrl ? `
            <div class="cta">
              <a href="${params.confirmUrl}" class="btn btn-confirm">I've Paid</a>
            </div>
          ` : ""}
          ${params.extraText ? `<p style="color: #64748b; font-size: 13px;">${params.extraText}</p>` : ""}
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

export function buildPaymentReminderTelegramText(
  params: Pick<
    PaymentReminderTemplateParams,
    "memberName" | "groupName" | "periodLabel" | "amount" | "currency" | "paymentLink" | "adjustmentReason" | "priceNote"
  >
): string {
  const noteLine = params.adjustmentReason || params.priceNote
    ? `\n⚠️ <i>${params.adjustmentReason || params.priceNote}</i>\n`
    : "";
  return (
    `💳 <b>Payment Reminder</b>\n\n` +
    `${params.memberName}, you owe <b>${params.amount.toFixed(2)}${params.currency}</b>\n` +
    `for <b>${params.groupName}</b> — ${params.periodLabel}\n` +
    noteLine + `\n` +
    (params.paymentLink ? `Pay: ${params.paymentLink}\n\n` : "") +
    `Tap below to confirm once paid.`
  );
}
