// shared footer for all transactional emails: app name, repo link, optional unsubscribe

import { APP_NAME, REPO_URL } from "@/lib/site";

export { APP_NAME, REPO_URL } from "@/lib/site";

export interface EmailFooterParams {
  appName?: string;
  repoUrl?: string;
  unsubscribeUrl?: string | null;
}

export function buildEmailFooterHtml(params: EmailFooterParams = {}): string {
  const appName = params.appName ?? APP_NAME;
  const repoUrl = params.repoUrl ?? REPO_URL;
  const unsubscribeUrl = params.unsubscribeUrl ?? null;
  const repoHost = repoUrl.replace(/^https:\/\//, "");

  const repoLink = `<a href="${repoUrl}" style="color: #64748b; text-decoration: underline;">source on GitHub</a>`;
  const lines: string[] = [`Sent by ${appName}`, `·`, repoLink];
  if (unsubscribeUrl) {
    lines.push("·", `<a href="${unsubscribeUrl}" style="color: #64748b;">Unsubscribe</a> from these emails`);
  }

  const metaLine = lines.join(" ");
  const urlLine = `<a href="${repoUrl}" style="color: #64748b; word-break: break-all;">${repoHost}</a>`;

  return `
    <p style="margin: 0 0 8px 0;">${metaLine}</p>
    <p style="margin: 0; font-size: 11px; line-height: 1.4;">${urlLine}</p>
  `;
}
