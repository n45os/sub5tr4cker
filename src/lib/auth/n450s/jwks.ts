import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload, JWTVerifyGetKey } from "jose";
import { getN450sAuthConfig } from "./config";

export interface N450sJwtPayload extends JWTPayload {
  sub: string;
  /** may appear on access tokens even when /oauth/userinfo omits email */
  email?: string;
  /** may appear on access tokens when userinfo name is generic */
  name?: string;
  /** n450s may also expose the auth-service user row id here */
  backendUserId?: string;
  client_id?: string;
  scope?: string;
  tokenType?: string;
  role?: string;
}

let remoteJwks: JWTVerifyGetKey | null = null;
let testJwks: JWTVerifyGetKey | null = null;

function getJwks(): JWTVerifyGetKey {
  if (testJwks) return testJwks;
  if (remoteJwks) return remoteJwks;
  const cfg = getN450sAuthConfig();
  remoteJwks = createRemoteJWKSet(
    new URL(`${cfg.authServiceUrl}/.well-known/jwks.json`)
  );
  return remoteJwks;
}

/**
 * verify an access token issued by n450s_auth. enforces RS256, the n450s-auth
 * issuer, and an audience scoped to our client id — wrong values here mean the
 * token came from elsewhere and must not be trusted.
 */
export async function verifyAccessToken(
  token: string
): Promise<N450sJwtPayload> {
  const cfg = getN450sAuthConfig();
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: "n450s-auth",
    audience: `service:${cfg.oauthClientId}`,
    algorithms: ["RS256"],
  });
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("verified token missing sub claim");
  }
  return payload as N450sJwtPayload;
}

/** test-only: inject a JWKS resolver to verify tokens against a local key */
export function __setJwksForTests(resolver: JWTVerifyGetKey | null): void {
  testJwks = resolver;
}
