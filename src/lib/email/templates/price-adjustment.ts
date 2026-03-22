import { buildEmailShell } from "@/lib/email/layout";

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
  paymentInstructions?: string | null;
  confirmUrl: string | null;
  /** when true, difference is a credit (reduces next payment) rather than amount due */
  isCredit?: boolean;
  unsubscribeUrl?: string | null;
  accentColor?: string | null;
  theme?: string | null;
}

export function buildPriceAdjustmentEmailHtml(
  params: PriceAdjustmentTemplateParams,
): string {
  const effectiveDifference = Math.abs(params.difference);
  const summaryText = params.difference === 0
    ? `Your share for the next period is ${params.currency} ${params.newAmount.toFixed(2)}.`
    : params.isCredit
      ? `You have a credit of ${params.currency} ${effectiveDifference.toFixed(2)}.`
      : `You owe an additional ${params.currency} ${effectiveDifference.toFixed(2)}.`;

  const paymentBlock =
    !params.isCredit && params.difference > 0
      ? `
        <div class="section-card">
          <p class="kicker">Payment details</p>
          <div class="rows">
            ${params.paymentLink ? `
              <div class="row">
                <span class="label">Payment link</span>
                <span class="value"><a href="${params.paymentLink}">Open payment link</a></span>
              </div>
            ` : ""}
            ${params.paymentInstructions ? `
              <div class="row">
                <span class="label">Instructions</span>
                <span class="value">${params.paymentInstructions}</span>
              </div>
            ` : ""}
          </div>
        </div>
      `
      : "";

  const bodyHtml = `
    <p>Hi ${params.memberName},</p>
    <p>The price for <strong>${params.groupName}</strong> has been adjusted for ${params.periodLabel}.</p>
    <div class="summary-card">
      <p class="kicker">${params.isCredit ? "Credit update" : "Adjustment summary"}</p>
      <p class="amount">${params.currency} ${effectiveDifference.toFixed(2)}</p>
      <p class="muted">${summaryText}</p>
      <div class="rows">
        <div class="row">
          <span class="label">Previous share</span>
          <span class="value">${params.currency} ${params.originalAmount.toFixed(2)}</span>
        </div>
        <div class="row">
          <span class="label">New share</span>
          <span class="value">${params.currency} ${params.newAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
    <div class="note-box"><strong>Reason:</strong> ${params.reason}</div>
    ${paymentBlock}
    ${params.paymentLink && !params.isCredit ? `
      <div class="cta">
        <a href="${params.paymentLink}" class="btn">Pay difference</a>
      </div>
    ` : ""}
    ${params.confirmUrl ? `
      <div class="cta">
        <a href="${params.confirmUrl}" class="btn btn-confirm">Verify payment</a>
      </div>
    ` : ""}
  `;

  return buildEmailShell({
    title: "Price Adjustment",
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null,
  });
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
