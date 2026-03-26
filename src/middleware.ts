import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOCAL_AUTH_COOKIE = "sub5tr4cker-local-auth";

/** set pathname header so dashboard layout can redirect to login with callbackUrl */
export function middleware(request: NextRequest) {
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
  }

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/api/:path*"],
};
