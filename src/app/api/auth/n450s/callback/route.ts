import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  exchangeCodeForTokens,
  getUserinfo,
  type OAuthTokenResponse,
  type UserinfoResponse,
} from "@/lib/auth/n450s/oauth-client";
import { verifyAccessToken } from "@/lib/auth/n450s/jwks";

const STATE_COOKIE = "n450s.oauth_state";

interface StatePayload {
  state: string;
  codeVerifier: string;
  callbackUrl: string;
  redirectUri: string;
}

function getCookieSecret(): string {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "dev-secret-change-in-production"
      : "");
  if (!secret) {
    throw new Error("missing NEXTAUTH_SECRET / AUTH_SECRET for state cookie verification");
  }
  return secret;
}

function verifyStateCookie(raw: string | undefined): StatePayload | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expected = crypto
    .createHmac("sha256", getCookieSecret())
    .update(data)
    .digest("base64url");
  // length-safe compare to avoid timing leaks on the signature
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString()) as StatePayload;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.callbackUrl !== "string" ||
      typeof parsed.redirectUri !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeCallbackUrl(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

// phase 3 will replace this with a real cookie writer; for now we just
// stash what we'd persist on the response so the route is end-to-end testable
async function setSessionTokens(
  res: NextResponse,
  _tokens: OAuthTokenResponse,
  _userinfo: UserinfoResponse
): Promise<void> {
  // intentional no-op — implemented in phase 3 (token storage + middleware refresh)
  void res;
}

function errorResponse(status: number, message: string): NextResponse {
  const res = NextResponse.json({ error: { code: "oauth_callback", message } }, { status });
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookie = req.cookies.get(STATE_COOKIE)?.value;
  const stored = verifyStateCookie(cookie);

  if (oauthError) {
    return errorResponse(400, `n450s_auth returned error: ${oauthError}`);
  }
  if (!code || !stateParam) {
    return errorResponse(400, "missing code or state in callback");
  }
  if (!stored) {
    return errorResponse(400, "state cookie missing or invalid");
  }
  if (
    stored.state.length !== stateParam.length ||
    !crypto.timingSafeEqual(Buffer.from(stored.state), Buffer.from(stateParam))
  ) {
    return errorResponse(400, "state mismatch");
  }

  let tokens: OAuthTokenResponse;
  try {
    tokens = await exchangeCodeForTokens(code, stored.codeVerifier, stored.redirectUri);
  } catch (err) {
    return errorResponse(502, err instanceof Error ? err.message : "code exchange failed");
  }

  try {
    await verifyAccessToken(tokens.access_token);
  } catch (err) {
    return errorResponse(
      401,
      err instanceof Error ? err.message : "access token verification failed"
    );
  }

  let userinfo: UserinfoResponse;
  try {
    userinfo = await getUserinfo(tokens.access_token);
  } catch (err) {
    return errorResponse(
      502,
      err instanceof Error ? err.message : "userinfo fetch failed"
    );
  }

  const dest = new URL(sanitizeCallbackUrl(stored.callbackUrl), url.origin);
  const res = NextResponse.redirect(dest.toString());
  res.cookies.delete(STATE_COOKIE);
  await setSessionTokens(res, tokens, userinfo);
  return res;
}
