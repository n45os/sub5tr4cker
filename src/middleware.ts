import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/n450s/jwks";
import { refreshTokens } from "@/lib/auth/n450s/oauth-client";
import {
  clearSessionTokens,
  readSessionTokens,
  setSessionTokens,
} from "@/lib/auth/n450s/session-cookies";
import {
  getCachedPayload,
  setCachedPayload,
} from "@/lib/auth/n450s/payload-cache";

const LOCAL_AUTH_COOKIE = "sub5tr4cker-local-auth";

function withPathname(res: NextResponse, pathname: string): NextResponse {
  res.headers.set("x-pathname", pathname);
  return res;
}

function isAdvancedProtectedPath(pathname: string): boolean {
  // dashboard pages require a session; api routes do their own auth via the
  // auth() wrapper so middleware does not redirect them to /login
  return pathname === "/" || pathname.startsWith("/dashboard");
}

function shouldRunAdvancedAuth(pathname: string): boolean {
  // never interfere with the n450s auth flow itself
  if (pathname.startsWith("/api/auth/")) return false;
  return true;
}

async function handleAdvancedMode(
  request: NextRequest,
  pathname: string
): Promise<NextResponse> {
  if (!shouldRunAdvancedAuth(pathname)) {
    return withPathname(NextResponse.next(), pathname);
  }

  const { accessToken, refreshToken } = readSessionTokens(request);

  if (accessToken) {
    if (getCachedPayload(accessToken)) {
      return withPathname(NextResponse.next(), pathname);
    }
    try {
      const payload = await verifyAccessToken(accessToken);
      setCachedPayload(accessToken, payload);
      return withPathname(NextResponse.next(), pathname);
    } catch {
      // access token invalid or expired — fall through to refresh attempt
    }
  }

  if (refreshToken) {
    try {
      const tokens = await refreshTokens(refreshToken);
      const expiresAt =
        Math.floor(Date.now() / 1000) + tokens.expires_in;
      const res = withPathname(NextResponse.next(), pathname);
      setSessionTokens(res, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
      return res;
    } catch {
      // refresh failed — treat as fully logged out
    }
  }

  if (isAdvancedProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    const callbackUrl = pathname + (request.nextUrl.search || "");
    url.pathname = "/login";
    url.search = `?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    const res = NextResponse.redirect(url);
    clearSessionTokens(res);
    return withPathname(res, pathname);
  }

  return withPathname(NextResponse.next(), pathname);
}

/** set pathname header so dashboard layout can redirect to login with callbackUrl */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // in local mode: auto-authenticate by setting the auth cookie
  if (process.env.SUB5TR4CKER_MODE === "local") {
    const authToken = process.env.SUB5TR4CKER_AUTH_TOKEN;
    if (authToken) {
      const existingToken = request.cookies.get(LOCAL_AUTH_COOKIE)?.value;
      if (!existingToken || existingToken !== authToken) {
        // redirect once so the next request includes the cookie
        if (!pathname.startsWith("/api/")) {
          const url = request.nextUrl.clone();
          const res = NextResponse.redirect(url);
          res.headers.set("x-pathname", pathname);
          res.cookies.set(LOCAL_AUTH_COOKIE, authToken, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
          });
          return res;
        }

        const res = NextResponse.next();
        res.headers.set("x-pathname", pathname);
        res.cookies.set(LOCAL_AUTH_COOKIE, authToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
        return res;
      }

      // keep auth screens out of the way in local single-user mode
      if (pathname === "/login" || pathname === "/register") {
        const url = request.nextUrl.clone();
        const callbackUrl = url.searchParams.get("callbackUrl");
        url.pathname = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
        url.search = "";
        const res = NextResponse.redirect(url);
        res.headers.set("x-pathname", pathname);
        return res;
      }
    }

    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  return handleAdvancedMode(request, pathname);
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/api/:path*"],
};
