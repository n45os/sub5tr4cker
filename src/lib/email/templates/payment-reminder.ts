import { buildEmailShell } from "@/lib/email/layout";
import { escapeTelegramHtml } from "@/lib/telegram/escape-html";

export interface PaymentReminderTemplateParams {
  memberName: string;
  groupName: string;
  periodLabel: string;
  amount: number;
  currency: string;
  paymentPlatform: string;
  paymentLink: string | null;
  paymentInstructions?: string | null;
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
  /** optional; template style preset */
  theme?: string | null;
}

export const paymentReminderSampleParams: PaymentReminderTemplateParams = {
  memberName: "Alex",
  groupName: "Family YouTube Premium",
  periodLabel: "Mar 2026",
  amount: 4.99,
  currency: "EUR",
  paymentPlatform: "revolut",
  paymentLink: "https://revolut.me/example",
  paymentInstructions: "Use reference \"YouTube\" in the transfer note.",
  confirmUrl: "https://example.com/member/example-token?pay=periodId",
  ownerName: "Nassos",
  extraText: "Please pay before the end of the week so access stays uninterrupted.",
};

export function buildPaymentReminderEmailHtml(
  params: PaymentReminderTemplateParams
): string {
  const bodyHtml = `
    <p class="kicker">${params.periodLabel}</p>
    <p>Hi ${params.memberName},</p>
    <p>You have an unpaid share for <strong>${params.groupName}</strong>.</p>
    <div class="amount-card">
      <p class="muted">Amount due</p>
      <p class="amount">${params.currency} ${params.amount.toFixed(2)}</p>
      <p class="muted">Managed by ${params.ownerName}</p>
    </div>
    ${(params.adjustmentReason || params.priceNote) ? `
      <div class="note-box">
        <strong>Note:</strong> ${params.adjustmentReason || params.priceNote}
      </div>
    ` : ""}
    <div class="section-card">
      <p class="kicker">Payment details</p>
      <div class="rows">
        <div class="row">
          <span class="label">Method</span>
          <span class="value" style="text-transform: capitalize;">${params.paymentPlatform.replaceAll("_", " ")}</span>
        </div>
        ${params.paymentLink ? `
          <div class="row">
            <span class="label">Link</span>
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
    ${params.paymentLink ? `
      <div class="cta">
        <a href="${params.paymentLink}" class="btn">Pay now</a>
      </div>
    ` : ""}
    ${params.confirmUrl ? `
      <div class="cta">
        <a href="${params.confirmUrl}" class="btn btn-confirm">Verify payment</a>
      </div>
    ` : ""}
    ${params.extraText ? `<p class="muted">${params.extraText}</p>` : ""}
    <p>After you pay, click <strong>Verify payment</strong> so your admin can confirm it.</p>
  `;

  return buildEmailShell({
    title: "Payment Reminder",
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null,
  });
}

export function buildPaymentReminderTelegramText(
  params: Pick<
    PaymentReminderTemplateParams,
    "memberName" | "groupName" | "periodLabel" | "amount" | "currency" | "paymentLink" | "adjustmentReason" | "priceNote"
  >
): string {
  const noteRaw = params.adjustmentReason || params.priceNote;
  const noteLine =
    noteRaw != null && noteRaw !== ""
      ? `\n⚠️ <i>${escapeTelegramHtml(noteRaw)}</i>\n`
      : "";
  const cur = escapeTelegramHtml(params.currency);
  const payLink = params.paymentLink ? escapeTelegramHtml(params.paymentLink) : null;
  return (
    `💳 <b>Payment Reminder</b>\n\n` +
    `${escapeTelegramHtml(params.memberName)}, you owe <b>${params.amount.toFixed(2)}${cur}</b>\n` +
    `for <b>${escapeTelegramHtml(params.groupName)}</b> — ${escapeTelegramHtml(params.periodLabel)}\n` +
    noteLine +
    `\n` +
    (payLink ? `Pay: ${payLink}\n\n` : "") +
    `Tap below to verify payment once paid.`
  );
}
