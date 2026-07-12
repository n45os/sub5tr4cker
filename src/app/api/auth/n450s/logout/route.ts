import { NextRequest, NextResponse } from "next/server";
import { getN450sAuthConfig } from "@/lib/auth/n450s/config";
import { resolvePublicOrigin } from "@/lib/auth/n450s/request-origin";
import { clearSessionTokens } from "@/lib/auth/n450s/session-cookies";

// transient oauth state plus the NextAuth credentials-fallback session cookies
const EXTRA_COOKIES = [
  "n450s.oauth_state",
  "authjs.session-token",
  "__Secure-authjs.session-token",
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
  clearSessionTokens(res);
  for (const name of EXTRA_COOKIES) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      secure: name.startsWith("__Secure-") || process.env.NODE_ENV === "production",
    });
  }
  return res;
}

export const POST = GET;
