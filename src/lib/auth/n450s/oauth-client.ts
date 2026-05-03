import { getN450sAuthConfig } from "./config";

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface UserinfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  role?: string;
  [key: string]: unknown;
}

function basicAuthHeader(): string {
  const cfg = getN450sAuthConfig();
  const encoded = Buffer.from(
    `${cfg.oauthClientId}:${cfg.oauthClientSecret}`
  ).toString("base64");
  return `Basic ${encoded}`;
}

async function postForm(
  path: string,
  body: URLSearchParams
): Promise<Response> {
  const cfg = getN450sAuthConfig();
  return fetch(`${cfg.authServiceUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: basicAuthHeader(),
    },
    body: body.toString(),
  });
}

async function readError(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri?: string
): Promise<OAuthTokenResponse> {
  const cfg = getN450sAuthConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri ?? cfg.redirectUris[0] ?? "",
  });
  const res = await postForm("/oauth/token", body);
  if (!res.ok) {
    throw new Error(
      `n450s_auth code exchange failed (${res.status}): ${await readError(res)}`
    );
  }
  return (await res.json()) as OAuthTokenResponse;
}

export async function refreshTokens(
  refreshToken: string
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await postForm("/oauth/token", body);
  if (!res.ok) {
    throw new Error(
      `n450s_auth refresh failed (${res.status}): ${await readError(res)}`
    );
  }
  return (await res.json()) as OAuthTokenResponse;
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const body = new URLSearchParams({
    token: refreshToken,
    token_type_hint: "refresh_token",
  });
  const res = await postForm("/oauth/revoke", body);
  if (!res.ok) {
    throw new Error(
      `n450s_auth revoke failed (${res.status}): ${await readError(res)}`
    );
  }
}

export async function getUserinfo(
  accessToken: string
): Promise<UserinfoResponse> {
  const cfg = getN450sAuthConfig();
  const res = await fetch(`${cfg.authServiceUrl}/oauth/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(
      `n450s_auth userinfo failed (${res.status}): ${await readError(res)}`
    );
  }
  return (await res.json()) as UserinfoResponse;
}
