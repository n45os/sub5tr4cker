import { NextRequest, NextResponse } from "next/server";
import { getN450sAuthConfig } from "@/lib/auth/n450s/config";
import { resolvePublicOrigin } from "@/lib/auth/n450s/request-origin";

// session cookies that phase 3 will start writing — clear them all here
// so logout is forward-compatible without touching this file again
const SESSION_COOKIES = [
  "n450s.access_token",
  "n450s.refresh_token",
  "n450s.session",
  "n450s.oauth_state",
];

function sanitizePostLogout(raw: string | null, origin: string): string {
  if (!raw) return `${origin}/`;
  if (raw.startsWith("/") && !raw.startsWith("//")) return `${origin}${raw}`;
  try {
    const parsed = new URL(raw);
    if (parsed.origin === origin) return parsed.toString();
  } catch {
    // fall through
  }
  return `${origin}/`;
}

export async function GET(req: NextRequest) {
  const cfg = getN450sAuthConfig();
  const publicOrigin = await resolvePublicOrigin(req);
  const postLogoutRedirectUri = sanitizePostLogout(
    req.nextUrl.searchParams.get("post_logout_redirect_uri"),
    publicOrigin
  );

  const target = new URL(`${cfg.authServiceUrl}/oauth/logout`);
  target.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);

  const res = NextResponse.redirect(target.toString());
  for (const name of SESSION_COOKIES) {
    res.cookies.delete(name);
  }
  return res;
}

export const POST = GET;
