import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/n450s/session-cookies";
import { clearPayloadCache } from "@/lib/auth/n450s/payload-cache";

vi.mock("@/lib/auth/n450s/jwks", () => ({
  verifyAccessToken: vi.fn(),
}));
vi.mock("@/lib/auth/n450s/oauth-client", () => ({
  refreshTokens: vi.fn(),
}));

const { verifyAccessToken } = await import("@/lib/auth/n450s/jwks");
const { refreshTokens } = await import("@/lib/auth/n450s/oauth-client");
const { middleware } = await import("./middleware");

function buildRequest(
  pathname: string,
  cookies: Record<string, string> = {}
): NextRequest {
  const url = `http://localhost:3054${pathname}`;
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("middleware (advanced mode)", () => {
  beforeEach(() => {
    delete process.env.SUB5TR4CKER_MODE;
    delete process.env.SUB5TR4CKER_AUTH_TOKEN;
    vi.mocked(verifyAccessToken).mockReset();
    vi.mocked(refreshTokens).mockReset();
    clearPayloadCache();
  });

  afterEach(() => {
    clearPayloadCache();
  });

  it("passes through with a valid access token (no redirect, no refresh)", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({ sub: "id-1" } as never);
    const req = buildRequest("/dashboard", { [ACCESS_COOKIE]: "valid-at" });

    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-pathname")).toBe("/dashboard");
    expect(refreshTokens).not.toHaveBeenCalled();
    expect(res.cookies.get(ACCESS_COOKIE)).toBeUndefined();
  });

  it("expired access token + valid refresh token → silent refresh, no redirect", async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(new Error("expired"));
    vi.mocked(refreshTokens).mockResolvedValue({
      access_token: "new-at",
      refresh_token: "new-rt",
      token_type: "Bearer",
      expires_in: 3600,
    } as never);

    const req = buildRequest("/dashboard", {
      [ACCESS_COOKIE]: "expired-at",
      [REFRESH_COOKIE]: "good-rt",
    });

    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(refreshTokens).toHaveBeenCalledWith("good-rt");
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("new-at");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("new-rt");
  });

  it("missing access token + valid refresh token → silent refresh", async () => {
    vi.mocked(refreshTokens).mockResolvedValue({
      access_token: "fresh-at",
      refresh_token: "fresh-rt",
      token_type: "Bearer",
      expires_in: 3600,
    } as never);

    const req = buildRequest("/dashboard", { [REFRESH_COOKIE]: "rt-only" });

    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(refreshTokens).toHaveBeenCalledWith("rt-only");
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("fresh-at");
  });

  it("expired access token + expired refresh token on protected path → redirect to /login with callbackUrl", async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(new Error("expired"));
    vi.mocked(refreshTokens).mockRejectedValue(new Error("refresh failed"));

    const req = buildRequest("/dashboard/groups", {
      [ACCESS_COOKIE]: "expired-at",
      [REFRESH_COOKIE]: "expired-rt",
    });

    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl=%2Fdashboard%2Fgroups");
    expect(res.cookies.get(ACCESS_COOKIE)?.maxAge).toBe(0);
    expect(res.cookies.get(REFRESH_COOKIE)?.maxAge).toBe(0);
  });

  it("no tokens on protected path → redirect to /login", async () => {
    const req = buildRequest("/");

    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/login");
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("no tokens on a non-protected path (e.g. /api/...) → pass through, no redirect", async () => {
    const req = buildRequest("/api/groups");

    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-pathname")).toBe("/api/groups");
  });

  it("never runs auth on /api/auth/* even with no tokens", async () => {
    const req = buildRequest("/api/auth/n450s/callback");

    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("preserves query string in callbackUrl when redirecting", async () => {
    const req = buildRequest("/dashboard?tab=open");

    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("callbackUrl=%2Fdashboard%3Ftab%3Dopen");
  });
});

describe("middleware (local mode)", () => {
  beforeEach(() => {
    process.env.SUB5TR4CKER_MODE = "local";
    process.env.SUB5TR4CKER_AUTH_TOKEN = "local-token";
    vi.mocked(verifyAccessToken).mockReset();
    vi.mocked(refreshTokens).mockReset();
  });

  afterEach(() => {
    delete process.env.SUB5TR4CKER_MODE;
    delete process.env.SUB5TR4CKER_AUTH_TOKEN;
  });

  it("never calls n450s helpers in local mode", async () => {
    const req = buildRequest("/dashboard", {
      "sub5tr4cker-local-auth": "local-token",
    });
    await middleware(req);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("redirects /login to /dashboard when local auth cookie is already set", async () => {
    const req = buildRequest("/login", {
      "sub5tr4cker-local-auth": "local-token",
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/dashboard");
  });
});
