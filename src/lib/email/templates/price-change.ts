import { buildEmailFooterHtml } from "@/lib/email/footer";
import { getAccentColor, buildAutomatedMessageBadgeHtml } from "@/lib/email/branding";

export interface PriceChangeTemplateParams {
  groupName: string;
  serviceName: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  /** optional; when set, footer includes unsubscribe link */
  unsubscribeUrl?: string | null;
  /** optional; hex accent for header */
  accentColor?: string | null;
}

export const priceChangeSampleParams: PriceChangeTemplateParams = {
  groupName: "Family YouTube Premium",
  serviceName: "YouTube Premium",
  oldPrice: 23.99,
  newPrice: 27.99,
  currency: "EUR",
};

// build HTML body for price-change announcement emails
export function buildPriceChangeEmailHtml(
  params: PriceChangeTemplateParams
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
        .price-row { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 20px 0; flex-wrap: wrap; }
        .old-price { font-size: 18px; color: #94a3b8; text-decoration: line-through; }
        .new-price { font-size: 24px; font-weight: bold; color: #1e293b; }
        .footer { padding: 16px 24px; background: #f8fafc; color: #94a3b8; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        ${buildAutomatedMessageBadgeHtml()}
        <div class="header">
          <h1>Price update</h1>
        </div>
        <div class="body">
          <p>The subscription price for <strong>${params.groupName}</strong> (${params.serviceName}) has been updated.</p>
          <div class="price-row">
            <span class="old-price">${params.oldPrice.toFixed(2)}${params.currency}</span>
            <span aria-hidden="true">→</span>
            <span class="new-price">${params.newPrice.toFixed(2)}${params.currency}</span>
          </div>
          <p>Your next billing cycle will use the new amount. If you have any questions, contact your group admin.</p>
        </div>
        <div class="footer">
          ${buildEmailFooterHtml({ unsubscribeUrl: params.unsubscribeUrl ?? null })}
        </div>
      </div>
    </body>
    </html>
  `;
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
