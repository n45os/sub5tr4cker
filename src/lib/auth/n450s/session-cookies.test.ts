import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionTokens,
  readSessionTokens,
  setSessionTokens,
} from "./session-cookies";

function makeRequestWithCookies(cookies: Record<string, string>): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest("http://localhost:3054/", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("session cookies", () => {
  it("writes access + refresh cookies with httpOnly/lax/path attributes", () => {
    const res = NextResponse.next();
    setSessionTokens(res, {
      accessToken: "at-value",
      refreshToken: "rt-value",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const access = res.cookies.get(ACCESS_COOKIE);
    const refresh = res.cookies.get(REFRESH_COOKIE);
    expect(access?.value).toBe("at-value");
    expect(refresh?.value).toBe("rt-value");
    expect(access?.httpOnly).toBe(true);
    expect(refresh?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe("lax");
    expect(refresh?.sameSite).toBe("lax");
    expect(access?.path).toBe("/");
    expect(refresh?.path).toBe("/");
  });

  it("derives the access-cookie max-age from expiresAt", () => {
    const res = NextResponse.next();
    const expiresAt = Math.floor(Date.now() / 1000) + 1800;
    setSessionTokens(res, {
      accessToken: "at",
      refreshToken: "rt",
      expiresAt,
    });
    const access = res.cookies.get(ACCESS_COOKIE);
    expect(access?.maxAge).toBeGreaterThanOrEqual(1700);
    expect(access?.maxAge).toBeLessThanOrEqual(1800);
  });

  it("clamps the access-cookie max-age to a 60s minimum when expiresAt is in the past", () => {
    const res = NextResponse.next();
    setSessionTokens(res, {
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    });
    expect(res.cookies.get(ACCESS_COOKIE)?.maxAge).toBe(60);
  });

  it("uses a 7-day refresh-cookie max-age regardless of access expiry", () => {
    const res = NextResponse.next();
    setSessionTokens(res, {
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    expect(res.cookies.get(REFRESH_COOKIE)?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it("round-trips: tokens set on a response can be read from a follow-up request", () => {
    const res = NextResponse.next();
    setSessionTokens(res, {
      accessToken: "at-roundtrip",
      refreshToken: "rt-roundtrip",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    const followup = makeRequestWithCookies({
      [ACCESS_COOKIE]: res.cookies.get(ACCESS_COOKIE)!.value,
      [REFRESH_COOKIE]: res.cookies.get(REFRESH_COOKIE)!.value,
    });
    const read = readSessionTokens(followup);
    expect(read.accessToken).toBe("at-roundtrip");
    expect(read.refreshToken).toBe("rt-roundtrip");
  });

  it("returns undefined for both tokens when no cookies are present", () => {
    const req = makeRequestWithCookies({});
    const read = readSessionTokens(req);
    expect(read.accessToken).toBeUndefined();
    expect(read.refreshToken).toBeUndefined();
  });

  it("clearSessionTokens writes empty cookies with maxAge 0", () => {
    const res = NextResponse.next();
    clearSessionTokens(res);
    const access = res.cookies.get(ACCESS_COOKIE);
    const refresh = res.cookies.get(REFRESH_COOKIE);
    expect(access?.value).toBe("");
    expect(refresh?.value).toBe("");
    expect(access?.maxAge).toBe(0);
    expect(refresh?.maxAge).toBe(0);
  });
});
