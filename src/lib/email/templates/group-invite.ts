import { buildEmailFooterHtml } from "@/lib/email/footer";
import { getAccentColor, buildAutomatedMessageBadgeHtml } from "@/lib/email/branding";

export interface GroupInviteTemplateParams {
  memberName: string;
  groupName: string;
  groupId: string;
  serviceName: string;
  adminName: string;
  billingSummary: string;
  paymentPlatform: string;
  paymentLink: string | null;
  paymentInstructions: string | null;
  isPublic: boolean;
  appUrl: string | null;
  telegramBotUsername: string | null;
  /** optional; when set, invite email uses this deep link for Telegram (member-specific) */
  telegramInviteLink?: string | null;
  /** optional; when set, footer includes unsubscribe link */
  unsubscribeUrl?: string | null;
  /** optional; hex accent for header and primary buttons */
  accentColor?: string | null;
}

export const groupInviteSampleParams: GroupInviteTemplateParams = {
  memberName: "Alex",
  groupName: "Family YouTube Premium",
  groupId: "example-group-id",
  serviceName: "YouTube Premium",
  adminName: "Nassos",
  billingSummary: "18 EUR per month, equal split",
  paymentPlatform: "revolut",
  paymentLink: "https://revolut.me/example",
  paymentInstructions: "Use reference 'YouTube' and pay before the 5th.",
  isPublic: true,
  appUrl: "https://substrack.example.com",
  telegramBotUsername: "sub5tr4ckerBot",
};

export function buildGroupInviteEmailHtml(
  params: GroupInviteTemplateParams
): string {
  const accent = getAccentColor(params.accentColor);
  const viewGroupUrl = params.isPublic && params.appUrl
    ? `${params.appUrl.replace(/\/$/, "")}/dashboard/groups/${params.groupId}`
    : null;
  const settingsUrl = params.isPublic && params.appUrl
    ? `${params.appUrl.replace(/\/$/, "")}/dashboard/settings`
    : null;
  const telegramSection =
    params.telegramBotUsername
      ? params.telegramInviteLink
        ? `
        <div class="section">
          <p class="section-title">Get updates via Telegram</p>
          <p>Receive payment reminders and confirm payments from your phone.</p>
          <div class="cta">
            <a href="${params.telegramInviteLink}" class="btn">Get updates via Telegram</a>
          </div>
        </div>`
        : `
        <div class="section">
          <p class="section-title">Get updates via Telegram</p>
          <p>Start a chat with <strong>@${params.telegramBotUsername}</strong> and send <code>/start</code> to receive payment reminders and confirm payments from your phone.</p>
        </div>`
      : "";

  const publicCtas =
    viewGroupUrl && settingsUrl
      ? `
        <div class="cta">
          <a href="${viewGroupUrl}" class="btn">View group</a>
        </div>
        <div class="cta">
          <a href="${settingsUrl}" class="btn btn-secondary">Manage notifications</a>
        </div>
        ${params.telegramBotUsername
          ? params.telegramInviteLink
            ? `<p class="hint">You can also link Telegram via the app using the link above.</p>`
            : `<p class="hint">You can also link Telegram via the app: start a chat with @${params.telegramBotUsername} and send <code>/start</code>.</p>`
          : ""}`
      : "";

  const privateSection = !params.isPublic
    ? `
        <div class="section reply-section">
          <p class="section-title">Questions?</p>
          <p>Reply to this email or contact <strong>${params.adminName}</strong> for anything you need.</p>
        </div>`
    : "";

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
        .section { margin: 20px 0; }
        .section-title { font-weight: 600; color: #1e293b; margin-bottom: 8px; }
        .reply-section { background: #f8fafc; padding: 16px; border-radius: 6px; }
        .btn { display: inline-block; background: ${accent}; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; }
        .btn-secondary { background: #64748b; }
        .cta { text-align: center; margin: 16px 0; }
        .hint { font-size: 13px; color: #64748b; text-align: center; margin-top: 8px; }
        .footer { padding: 16px 24px; background: #f8fafc; color: #94a3b8; font-size: 12px; text-align: center; }
        code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        ${buildAutomatedMessageBadgeHtml()}
        <div class="header">
          <h1>You've been added to ${params.groupName}</h1>
        </div>
        <div class="body">
          <p>Hi ${params.memberName},</p>
          <p><strong>${params.adminName}</strong> has added you to the subscription group <strong>${params.groupName}</strong> (${params.serviceName}).</p>

          <div class="section">
            <p class="section-title">Billing</p>
            <p>${params.billingSummary}</p>
          </div>

          ${params.paymentLink ? `
          <div class="section">
            <p class="section-title">How to pay</p>
            <p>Pay via <strong>${params.paymentPlatform}</strong>: <a href="${params.paymentLink}">${params.paymentLink}</a></p>
            ${params.paymentInstructions ? `<p style="color: #64748b; font-size: 14px;">${params.paymentInstructions}</p>` : ""}
          </div>` : ""}

          ${params.paymentInstructions && !params.paymentLink ? `
          <div class="section">
            <p class="section-title">Payment instructions</p>
            <p>${params.paymentInstructions}</p>
          </div>` : ""}

          ${telegramSection}
          ${privateSection}
          ${publicCtas}
        </div>
        <div class="footer">
          ${buildEmailFooterHtml({ unsubscribeUrl: params.unsubscribeUrl ?? null })}
        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildGroupInviteTelegramText(
  params: Pick<
    GroupInviteTemplateParams,
    | "memberName"
    | "groupName"
    | "serviceName"
    | "adminName"
    | "billingSummary"
    | "paymentLink"
    | "paymentPlatform"
    | "telegramBotUsername"
    | "telegramInviteLink"
    | "isPublic"
    | "appUrl"
  >
): string {
  let text =
    `👋 <b>You've been added to ${params.groupName}</b>\n\n` +
    `${params.memberName}, ${params.adminName} added you to <b>${params.groupName}</b> (${params.serviceName}).\n\n` +
    `Billing: ${params.billingSummary}\n`;
  if (params.paymentLink) {
    text += `Pay: ${params.paymentLink} (${params.paymentPlatform})\n`;
  }
  if (params.isPublic && params.appUrl) {
    text += `\nView group & manage notifications: ${params.appUrl.replace(/\/$/, "")}/dashboard\n`;
  }
  if (params.telegramInviteLink) {
    text += `\nGet reminders here: ${params.telegramInviteLink}`;
  } else if (params.telegramBotUsername) {
    text += `\nGet reminders here: start a chat with @${params.telegramBotUsername} and send /start`;
  }
  return text;
}
