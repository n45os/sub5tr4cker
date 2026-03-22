import { buildEmailShell } from "@/lib/email/layout";

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
  /** optional; when set, shows accept invite action in email */
  acceptInviteUrl?: string | null;
  /** optional; when set, footer includes unsubscribe link */
  unsubscribeUrl?: string | null;
  /** optional; hex accent for header and primary buttons */
  accentColor?: string | null;
  /** optional; template style preset */
  theme?: string | null;
}

export interface TelegramWelcomeTemplateParams
  extends Omit<GroupInviteTemplateParams, "acceptInviteUrl"> {
  magicLoginUrl: string;
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
  acceptInviteUrl: "https://substrack.example.com/api/invite/accept/sample",
};

function buildInvitePaymentSection(params: GroupInviteTemplateParams): string {
  if (params.paymentLink) {
    return `
      <div class="section-card">
        <p class="kicker">Payment details</p>
        <div class="rows">
          <div class="row">
            <span class="label">Method</span>
            <span class="value" style="text-transform: capitalize;">${params.paymentPlatform.replaceAll("_", " ")}</span>
          </div>
          <div class="row">
            <span class="label">Payment link</span>
            <span class="value"><a href="${params.paymentLink}">Open payment link</a></span>
          </div>
          ${params.paymentInstructions ? `
            <div class="row">
              <span class="label">Instructions</span>
              <span class="value">${params.paymentInstructions}</span>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  if (params.paymentInstructions) {
    return `
      <div class="section-card">
        <p class="kicker">Payment instructions</p>
        <p>${params.paymentInstructions}</p>
      </div>
    `;
  }

  return "";
}

export function buildGroupInviteEmailHtml(
  params: GroupInviteTemplateParams
): string {
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
        <div class="section-card">
          <p class="kicker">Telegram updates</p>
          <p>Receive payment reminders and confirm payments from your phone.</p>
          <div class="cta">
            <a href="${params.telegramInviteLink}" class="btn">Get updates via Telegram</a>
          </div>
        </div>`
        : `
        <div class="section-card">
          <p class="kicker">Telegram updates</p>
          <p>Start a chat with <strong>@${params.telegramBotUsername}</strong> and send <code>/start</code> to receive payment reminders and confirm payments from your phone.</p>
        </div>`
      : "";
  const acceptSection = params.acceptInviteUrl
    ? `
        <div class="section-card">
          <p class="kicker">Accept invite</p>
          <p>Confirm that you want to join this group.</p>
          <div class="cta">
            <a href="${params.acceptInviteUrl}" class="btn">Accept invite</a>
          </div>
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
        <p class="muted" style="text-align: center;">
          ${params.telegramBotUsername
            ? params.telegramInviteLink
              ? `You can also link Telegram via the app using the link above.`
              : `You can also link Telegram via the app: start a chat with @${params.telegramBotUsername} and send <code>/start</code>.`
            : ""}
        </p>`
      : "";

  const privateSection = !params.isPublic
    ? `
        <div class="section-card">
          <p class="kicker">Questions?</p>
          <p>Reply to this email or contact <strong>${params.adminName}</strong> for anything you need.</p>
        </div>`
    : "";

  const bodyHtml = `
    <p>Hi ${params.memberName},</p>
    <p><strong>${params.adminName}</strong> added you to <strong>${params.groupName}</strong> (${params.serviceName}).</p>
    <div class="section-card">
      <p class="kicker">Billing setup</p>
      <p>${params.billingSummary}</p>
    </div>
    ${buildInvitePaymentSection(params)}
    ${acceptSection}
    ${telegramSection}
    ${privateSection}
    ${publicCtas}
  `;

  return buildEmailShell({
    title: `You were added to ${params.groupName}`,
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null,
  });
}

export function buildTelegramWelcomeEmailHtml(
  params: TelegramWelcomeTemplateParams
): string {
  const settingsUrl =
    params.isPublic && params.appUrl
      ? `${params.appUrl.replace(/\/$/, "")}/dashboard/settings`
      : null;
  const telegramSection = params.telegramBotUsername
    ? params.telegramInviteLink
      ? `
        <div class="section-card">
          <p class="kicker">Telegram linked</p>
          <p>Your Telegram account is now linked for payment reminders and confirmations.</p>
          <div class="cta">
            <a href="${params.telegramInviteLink}" class="btn btn-secondary">Open Telegram chat</a>
          </div>
        </div>`
      : `
        <div class="section-card">
          <p class="kicker">Telegram linked</p>
          <p>Your Telegram account is now linked with <strong>@${params.telegramBotUsername}</strong>.</p>
        </div>`
    : "";

  const bodyHtml = `
    <p>Hi ${params.memberName},</p>
    <p>Your Telegram account is now linked for <strong>${params.groupName}</strong>.</p>
    <div class="cta">
      <a href="${params.magicLoginUrl}" class="btn">Sign in to sub5tr4cker</a>
    </div>
    <div class="section-card">
      <p class="kicker">Billing setup</p>
      <p>${params.billingSummary}</p>
    </div>
    ${buildInvitePaymentSection(params)}
    ${telegramSection}
    ${settingsUrl ? `<p class="muted">Manage channels: <a href="${settingsUrl}">${settingsUrl}</a></p>` : ""}
  `;

  return buildEmailShell({
    title: `Welcome to ${params.groupName}`,
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null,
  });
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
