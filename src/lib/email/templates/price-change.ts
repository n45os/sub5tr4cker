import { buildEmailShell } from "@/lib/email/layout";

export interface PriceChangeTemplateParams {
  groupName: string;
  serviceName: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  oldMemberShare?: number | null;
  newMemberShare?: number | null;
  nextPeriodLabel?: string | null;
  /** optional; when set, footer includes unsubscribe link */
  unsubscribeUrl?: string | null;
  /** optional; hex accent for header */
  accentColor?: string | null;
  /** optional; template style preset */
  theme?: string | null;
}

export const priceChangeSampleParams: PriceChangeTemplateParams = {
  groupName: "Family YouTube Premium",
  serviceName: "YouTube Premium",
  oldPrice: 23.99,
  newPrice: 27.99,
  currency: "EUR",
  oldMemberShare: 4.8,
  newMemberShare: 5.6,
  nextPeriodLabel: "Apr 2026",
};

// build HTML body for price-change announcement emails
export function buildPriceChangeEmailHtml(
  params: PriceChangeTemplateParams
): string {
  const memberImpact =
    params.oldMemberShare != null && params.newMemberShare != null
      ? `
        <div class="section-card">
          <p class="kicker">Your share</p>
          <div class="rows">
            <div class="row">
              <span class="label">Previous</span>
              <span class="value">${params.currency} ${params.oldMemberShare.toFixed(2)}</span>
            </div>
            <div class="row">
              <span class="label">New</span>
              <span class="value">${params.currency} ${params.newMemberShare.toFixed(2)}</span>
            </div>
          </div>
        </div>
      `
      : "";

  const bodyHtml = `
    <p>The subscription price for <strong>${params.groupName}</strong> (${params.serviceName}) has been updated.</p>
    <div class="section-card">
      <p class="kicker">Group total price</p>
      <div class="rows">
        <div class="row">
          <span class="label">Previous</span>
          <span class="value">${params.currency} ${params.oldPrice.toFixed(2)}</span>
        </div>
        <div class="row">
          <span class="label">New</span>
          <span class="value">${params.currency} ${params.newPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
    ${memberImpact}
    <p>${params.nextPeriodLabel ? `Starting from ${params.nextPeriodLabel}, ` : "Your next billing cycle "}this new amount will be used.</p>
  `;

  return buildEmailShell({
    title: "Price Update",
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null,
  });
}

export function buildPriceChangeTelegramText(
  params: PriceChangeTemplateParams
): string {
  return (
    `📢 <b>Price update</b>\n\n` +
    `<b>${params.groupName}</b> (${params.serviceName})\n\n` +
    `Previous: <s>${params.oldPrice.toFixed(2)}${params.currency}</s>\n` +
    `New: <b>${params.newPrice.toFixed(2)}${params.currency}</b>\n\n` +
    `Your next billing cycle will use the new amount.`
  );
}
