import { db } from "@/lib/storage";
import type { N450sJwtPayload } from "./jwks";

export interface ResolvedSessionUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
}

export interface ResolvedSession {
  user: ResolvedSessionUser;
  expires: string;
}

interface OptionalProfileFields {
  email?: unknown;
  name?: unknown;
  picture?: unknown;
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** prefer a real mailbox over `@n450s.local` placeholders; otherwise match OIDC `email` first */
function pickSessionEmail(
  tokenEmail: string | null,
  localEmail: string | null
): string | null {
  const local = pickString(localEmail);
  const token = pickString(tokenEmail);
  const synthetic = (e: string | null) => Boolean(e?.endsWith("@n450s.local"));
  if (synthetic(local) && !synthetic(token)) return token;
  if (synthetic(token) && !synthetic(local)) return local;
  return token ?? local;
}

const GENERIC_TOKEN_NAMES = new Set(["dashboard", "user", "admin", "profile"]);

/** prefer DB name when the token only carries a sub-shaped or generic display value */
function pickSessionName(
  tokenName: string | null,
  localName: string | null,
  sub: string
): string | null {
  const local = pickString(localName);
  const token = pickString(tokenName);
  if (token) {
    const lower = token.toLowerCase();
    if (GENERIC_TOKEN_NAMES.has(lower) && local) return local;
    if (token === sub && local) return local;
    if (/^[a-f0-9]{24}$/i.test(token) && local) return local;
    return token;
  }
  return local;
}

export async function resolveSessionFromPayload(
  payload: N450sJwtPayload
): Promise<ResolvedSession | null> {
  const profile = payload as N450sJwtPayload & OptionalProfileFields;
  const expSeconds =
    typeof payload.exp === "number"
      ? payload.exp
      : Math.floor(Date.now() / 1000) + 60;

  const store = await db();
  const localUser = await store.getUserByAuthIdentityId(payload.sub);
  if (!localUser) return null;

  return {
    user: {
      id: localUser.id,
      email: pickSessionEmail(
        pickString(profile.email),
        localUser.email ?? null
      ),
      name: pickSessionName(
        pickString(profile.name),
        localUser.name ?? null,
        payload.sub
      ),
      image: pickString(profile.picture) ?? localUser.image ?? null,
      role: localUser.role ?? (typeof payload.role === "string" ? payload.role : "user"),
    },
    expires: new Date(expSeconds * 1000).toISOString(),
  };
}
