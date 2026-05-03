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
      email: pickString(profile.email) ?? localUser.email ?? null,
      name: pickString(profile.name) ?? localUser.name ?? null,
      image: pickString(profile.picture) ?? localUser.image ?? null,
      role: localUser.role ?? (typeof payload.role === "string" ? payload.role : "user"),
    },
    expires: new Date(expSeconds * 1000).toISOString(),
  };
}
