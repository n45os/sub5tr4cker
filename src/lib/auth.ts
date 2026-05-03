import { cookies } from "next/headers";
import { isLocalMode } from "@/lib/config/manager";
import { buildLocalSession, validateAuthToken, LOCAL_AUTH_COOKIE } from "@/lib/auth/local";
import { ACCESS_COOKIE } from "@/lib/auth/n450s/session-cookies";
import { verifyAccessToken } from "@/lib/auth/n450s/jwks";
import { getCachedPayload, setCachedPayload } from "@/lib/auth/n450s/payload-cache";
import { resolveSessionFromPayload, type ResolvedSession } from "@/lib/auth/n450s/session-resolver";

/**
 * auth() wrapper.
 * - local mode: returns the synthetic local admin session when the auth cookie
 *   is valid (or when called outside a request context, e.g. cron scripts).
 * - advanced mode: reads the n450s_auth access-token cookie, verifies it
 *   (re-using the request-scoped payload cache populated by middleware), and
 *   maps the payload to the canonical session shape. returns null on any
 *   failure.
 */
async function authWrapper(): Promise<ResolvedSession | null> {
  if (isLocalMode()) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(LOCAL_AUTH_COOKIE)?.value;
      if (!token || !validateAuthToken(token)) return null;
      return buildLocalSession();
    } catch {
      // cookies() throws outside of a request context (e.g. in cron scripts)
      return buildLocalSession();
    }
  }

  let accessToken: string | undefined;
  try {
    const cookieStore = await cookies();
    accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!accessToken) return null;

  let payload = getCachedPayload(accessToken);
  if (!payload) {
    try {
      payload = await verifyAccessToken(accessToken);
      setCachedPayload(accessToken, payload);
    } catch {
      return null;
    }
  }

  return resolveSessionFromPayload(payload);
}

export { authWrapper as auth };
