// shared footer for all transactional emails: app name, repo link, optional unsubscribe

export const REPO_URL = "https://github.com/n45os/sub5tr4cker";
export const APP_NAME = "sub5tr4cker";

export interface EmailFooterParams {
  appName?: string;
  repoUrl?: string;
  unsubscribeUrl?: string | null;
}

export function buildEmailFooterHtml(params: EmailFooterParams = {}): string {
  const appName = params.appName ?? APP_NAME;
  const repoUrl = params.repoUrl ?? REPO_URL;
  const unsubscribeUrl = params.unsubscribeUrl ?? null;

  const repoLink = `<a href="${repoUrl}" style="color: #64748b;">GitHub</a>`;
  const lines: string[] = [`Sent by ${appName}`, `·`, repoLink];
  if (unsubscribeUrl) {
    lines.push("·", `<a href="${unsubscribeUrl}" style="color: #64748b;">Unsubscribe</a> from these emails`);
  }
  return `<p style="margin: 0;">${lines.join(" ")}</p>`;
}
