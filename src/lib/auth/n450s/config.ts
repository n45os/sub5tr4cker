export interface N450sAuthConfig {
  authServiceUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  redirectUris: string[];
}

const REQUIRED_ENV = [
  "AUTH_SERVICE_URL",
  "OAUTH_CLIENT_ID",
  "OAUTH_CLIENT_SECRET",
  "OAUTH_REDIRECT_URIS",
] as const;

let cached: N450sAuthConfig | null = null;

/**
 * read n450s_auth client config from env. local mode never calls this; advanced
 * mode does, and a missing var here is a hard boot failure rather than a soft
 * fallback because the entire auth flow depends on these values.
 */
export function getN450sAuthConfig(): N450sAuthConfig {
  if (cached) return cached;

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `n450s_auth config missing required env vars: ${missing.join(", ")}`
    );
  }

  cached = {
    authServiceUrl: process.env.AUTH_SERVICE_URL!.replace(/\/+$/, ""),
    oauthClientId: process.env.OAUTH_CLIENT_ID!,
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET!,
    redirectUris: process.env
      .OAUTH_REDIRECT_URIS!.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
  return cached;
}

/** test-only: drop the cached config so the next call re-reads process.env */
export function __resetN450sAuthConfigForTests(): void {
  cached = null;
}
