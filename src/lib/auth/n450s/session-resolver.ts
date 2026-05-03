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

// todo(phase-5): once User.authIdentityId is populated, resolve the local
// User._id by sub and surface it as `user.id`. for now we hand back sub
// directly so the rest of the app keeps working during the migration.
export function resolveSessionFromPayload(
  payload: N450sJwtPayload
): ResolvedSession {
  const profile = payload as N450sJwtPayload & OptionalProfileFields;
  const expSeconds =
    typeof payload.exp === "number"
      ? payload.exp
      : Math.floor(Date.now() / 1000) + 60;
  return {
    user: {
      id: payload.sub,
      email: pickString(profile.email),
      name: pickString(profile.name),
      image: pickString(profile.picture),
      role: typeof payload.role === "string" ? payload.role : "user",
    },
    expires: new Date(expSeconds * 1000).toISOString(),
  };
}
