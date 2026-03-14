// shared branding for notification emails: accent color and automated-message badge

export const DEFAULT_ACCENT_COLOR = "#3b82f6";

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

/** returns a valid hex accent color or the default */
export function getAccentColor(accent: string | null | undefined): string {
  return accent && HEX_REGEX.test(accent) ? accent : DEFAULT_ACCENT_COLOR;
}

/** HTML for the automated-message badge shown near the top of each template */
export function buildAutomatedMessageBadgeHtml(): string {
  return `
    <div style="padding: 10px 24px; background: #f1f5f9; color: #64748b; font-size: 12px; text-align: center; border-bottom: 1px solid #e2e8f0;">
      This is an automated message from your subscription group.
    </div>`;
}
