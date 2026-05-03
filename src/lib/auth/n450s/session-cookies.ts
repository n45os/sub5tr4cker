import type { NextRequest, NextResponse } from "next/server";

export const ACCESS_COOKIE = "s5_at";
export const REFRESH_COOKIE = "s5_rt";

// refresh token max-age — n450s_auth uses sliding expiry, so the cookie is
// rewritten on every successful refresh and effectively follows the user
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ACCESS_MIN_MAX_AGE_SECONDS = 60;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  // unix epoch seconds — used to derive Max-Age for the access cookie
  expiresAt: number;
}

export interface ReadSessionTokens {
  accessToken: string | undefined;
  refreshToken: string | undefined;
}

function baseCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function setSessionTokens(
  res: NextResponse,
  tokens: SessionTokens
): void {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessMaxAge = Math.max(
    ACCESS_MIN_MAX_AGE_SECONDS,
    tokens.expiresAt - nowSeconds
  );
  const opts = baseCookieOptions();
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...opts,
    maxAge: accessMaxAge,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...opts,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function readSessionTokens(req: NextRequest): ReadSessionTokens {
  return {
    accessToken: req.cookies.get(ACCESS_COOKIE)?.value,
    refreshToken: req.cookies.get(REFRESH_COOKIE)?.value,
  };
}

export function clearSessionTokens(res: NextResponse): void {
  const opts = baseCookieOptions();
  res.cookies.set(ACCESS_COOKIE, "", { ...opts, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...opts, maxAge: 0 });
}
