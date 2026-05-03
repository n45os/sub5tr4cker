import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getN450sAuthConfig } from "@/lib/auth/n450s/config";
import { resolvePublicOrigin } from "@/lib/auth/n450s/request-origin";

// short-lived cookie that carries CSRF state, PKCE verifier, and the
// post-login destination across the redirect to n450s_auth and back
const STATE_COOKIE = "n450s.oauth_state";
const STATE_TTL_SECONDS = 600;

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function getCookieSecret(): string {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "dev-secret-change-in-production"
      : "");
  if (!secret) {
    throw new Error("missing NEXTAUTH_SECRET / AUTH_SECRET for state cookie signing");
  }
  return secret;
}

function signStatePayload(payload: object): string {
  const data = base64url(Buffer.from(JSON.stringify(payload)));
  const signature = crypto
    .createHmac("sha256", getCookieSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

// only accept same-origin paths to avoid open-redirect through the callbackUrl
function sanitizeCallbackUrl(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function pickRedirectUri(origin: string, configured: string[]): string {
  const expected = new URL("/api/auth/n450s/callback", origin).toString();
  if (configured.includes(expected)) return expected;
  return configured[0] ?? expected;
}

export async function GET(req: NextRequest) {
  const cfg = getN450sAuthConfig();
  const publicOrigin = await resolvePublicOrigin(req);

  const state = base64url(crypto.randomBytes(16));
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  const callbackUrl = sanitizeCallbackUrl(req.nextUrl.searchParams.get("callbackUrl"));
  const redirectUri = pickRedirectUri(publicOrigin, cfg.redirectUris);

  const consentUrl = new URL(`${cfg.authServiceUrl}/oauth/consent`);
  consentUrl.searchParams.set("client_id", cfg.oauthClientId);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("response_type", "code");
  consentUrl.searchParams.set("scope", "openid profile email");
  consentUrl.searchParams.set("state", state);
  consentUrl.searchParams.set("code_challenge", codeChallenge);
  consentUrl.searchParams.set("code_challenge_method", "S256");

  const cookieValue = signStatePayload({
    state,
    codeVerifier,
    callbackUrl,
    redirectUri,
  });

  const res = NextResponse.redirect(consentUrl.toString());
  res.cookies.set(STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
