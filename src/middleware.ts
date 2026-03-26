import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCAL_AUTH_COOKIE } from "@/lib/auth/local";

/** set pathname header so dashboard layout can redirect to login with callbackUrl */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // in local mode: auto-authenticate by setting the auth cookie if the
  // request comes from localhost and the SUB5TR4CKER_MODE env is "local"
  if (process.env.SUB5TR4CKER_MODE === "local") {
    const authToken = process.env.SUB5TR4CKER_AUTH_TOKEN;
    if (authToken) {
      const existingToken = request.cookies.get(LOCAL_AUTH_COOKIE)?.value;
      if (!existingToken || existingToken !== authToken) {
        // set the auth cookie on the first visit so the app is auto-logged in
        const res = NextResponse.next();
        res.headers.set("x-pathname", pathname);
        res.cookies.set(LOCAL_AUTH_COOKIE, authToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          // no expiry — session cookie that persists as long as the browser is open
        });
        return res;
      }
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
