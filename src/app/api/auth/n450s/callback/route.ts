import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  exchangeCodeForTokens,
  getUserinfo,
  type OAuthTokenResponse,
  type UserinfoResponse,
} from "@/lib/auth/n450s/oauth-client";
import { verifyAccessToken, type N450sJwtPayload } from "@/lib/auth/n450s/jwks";
import { resolvePublicOrigin } from "@/lib/auth/n450s/request-origin";
import { setSessionTokens } from "@/lib/auth/n450s/session-cookies";
import { db } from "@/lib/storage";
import type { StorageUser } from "@/lib/storage/types";

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

function persistSessionTokens(
  res: NextResponse,
  tokens: OAuthTokenResponse
): void {
  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;
  setSessionTokens(res, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  });
}

// link or auto-provision a local User row for this n450s identity. the access
// token's `sub` is canonical for auth(); userinfo.sub may differ (e.g. backend
// user id), so we key authIdentityId on the verified JWT only. we also heal
// rows linked under mistaken ids on first login after the fix.
async function linkOrCreateUserForIdentity(
  userinfo: UserinfoResponse,
  accessPayload: N450sJwtPayload
): Promise<StorageUser> {
  const store = await db();
  const identitySub = accessPayload.sub;
  const existingByCanonical = await store.getUserByAuthIdentityId(identitySub);
  if (existingByCanonical) return existingByCanonical;

  const mistakenSubs = new Set<string>();
  if (
    typeof accessPayload.backendUserId === "string" &&
    accessPayload.backendUserId.length > 0
  ) {
    mistakenSubs.add(accessPayload.backendUserId);
  }
  if (
    typeof userinfo.sub === "string" &&
    userinfo.sub.length > 0 &&
    userinfo.sub !== identitySub
  ) {
    mistakenSubs.add(userinfo.sub);
  }
  for (const wrongSub of mistakenSubs) {
    const u = await store.getUserByAuthIdentityId(wrongSub);
    if (u) {
      return await store.updateUser(u.id, { authIdentityId: identitySub });
    }
  }

  const emailFromUserinfo =
    typeof userinfo.email === "string" ? userinfo.email.toLowerCase().trim() : "";
  const emailFromAccessToken =
    typeof accessPayload.email === "string"
      ? accessPayload.email.toLowerCase().trim()
      : "";
  const email = emailFromUserinfo || emailFromAccessToken;
  if (email) {
    const existingByEmail = await store.getUserByEmail(email);
    if (existingByEmail && !existingByEmail.authIdentityId) {
      return await store.updateUser(existingByEmail.id, { authIdentityId: identitySub });
    }
  }

  const name =
    (typeof userinfo.name === "string" && userinfo.name.trim()) ||
    (typeof userinfo.preferred_username === "string" && userinfo.preferred_username.trim()) ||
    (email || identitySub);

  return await store.createUser({
    name,
    email: email || `${identitySub}@n450s.local`,
    role: userinfo.role === "admin" ? "admin" : "user",
    hashedPassword: null,
    authIdentityId: identitySub,
    notificationPreferences: {
      email: true,
      telegram: false,
      reminderFrequency: "every_3_days",
    },
  });
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

  let accessPayload: N450sJwtPayload;
  try {
    accessPayload = await verifyAccessToken(tokens.access_token);
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

  try {
    await linkOrCreateUserForIdentity(userinfo, accessPayload);
  } catch (err) {
    return errorResponse(
      500,
      err instanceof Error ? err.message : "user provisioning failed"
    );
  }

  const publicOrigin = await resolvePublicOrigin(req);
  const dest = new URL(sanitizeCallbackUrl(stored.callbackUrl), publicOrigin);
  const res = NextResponse.redirect(dest.toString());
  res.cookies.delete(STATE_COOKIE);
  persistSessionTokens(res, tokens);
  return res;
}
