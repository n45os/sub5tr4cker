import type { NextRequest } from "next/server";
import { getSetting } from "@/lib/settings/service";
import { normalizeAppUrl } from "@/lib/public-app-url";

function firstHeaderSegment(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

/**
 * browser-facing origin for OAuth redirects. behind Docker or a reverse
 * proxy, req.nextUrl.origin can be an internal host (container id:port); prefer
 * general.appUrl / APP_URL, then x-forwarded-* headers
 */
export async function resolvePublicOrigin(req: NextRequest): Promise<string> {
  const fromSetting = normalizeAppUrl(await getSetting("general.appUrl"));
  if (fromSetting) {
    try {
      const withScheme = /^[a-zA-Z][a-zA-Z+\-.]*:/.test(fromSetting)
        ? fromSetting
        : `https://${fromSetting}`;
      return new URL(withScheme).origin;
    } catch {
      // malformed setting — fall through
    }
  }

  const forwardedHost = firstHeaderSegment(req.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderSegment(req.headers.get("x-forwarded-proto"));

  if (forwardedHost) {
    const proto = forwardedProto ?? "https";
    return `${proto}://${forwardedHost}`;
  }

  return req.nextUrl.origin;
}
