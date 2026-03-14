import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** set pathname header so dashboard layout can redirect to login with callbackUrl */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
