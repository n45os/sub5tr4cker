import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { isLocalMode } from "@/lib/config/manager";
import { buildLocalSession, validateAuthToken, LOCAL_AUTH_COOKIE } from "@/lib/auth/local";
import { db } from "@/lib/storage";
import { ACCESS_COOKIE } from "@/lib/auth/n450s/session-cookies";
import { verifyAccessToken } from "@/lib/auth/n450s/jwks";
import { getCachedPayload, setCachedPayload } from "@/lib/auth/n450s/payload-cache";
import { resolveSessionFromPayload, type ResolvedSession } from "@/lib/auth/n450s/session-resolver";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const isLocalAuthMode = isLocalMode();

const {
  handlers: nextAuthHandlers,
  auth: nextAuth,
  signIn,
  signOut,
} = NextAuth({
  trustHost: true,
  secret:
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "development" ? "dev-secret-change-in-production" : undefined),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  cookies: {
    sessionToken: {
      options: {
        maxAge: SESSION_MAX_AGE,
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: isLocalAuthMode
    ? []
    : [
        CredentialsProvider({
          name: "credentials",
          credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" },
          },
          async authorize(credentials) {
            if (!credentials?.email || !credentials?.password) return null;
            const store = await db();
            const email = (credentials.email as string).toLowerCase().trim();
            const user = await store.getUserByEmail(email);
            if (!user || !user.hashedPassword) return null;
            const match = await compare(credentials.password as string, user.hashedPassword);
            if (!match) return null;
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
              role: user.role ?? "user",
            };
          },
        }),
      ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
        const store = await db();
        const u = await store.getUser(token.id as string);
        if (u) {
          session.user.email = u.email;
          session.user.name = u.name;
          session.user.image = u.image ?? null;
          (session.user as { role?: string }).role = u.role ?? "user";
        }
      }
      return session;
    },
  },
});

async function resolveNextAuthSession(): Promise<ResolvedSession | null> {
  const session = await nextAuth();
  if (!session?.user?.id) return null;
  return {
    user: {
      id: session.user.id as string,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
      role: (session.user as { role?: string }).role ?? "user",
    },
    expires: session.expires,
  };
}

/**
 * auth() wrapper.
 * - local mode: returns the synthetic local admin session when the auth cookie
 *   is valid (or when called outside a request context, e.g. cron scripts).
 * - advanced mode: prefers the n450s_auth access-token cookie; falls back to
 *   the NextAuth Credentials session for users who logged in with email and
 *   password. Returns null on any failure.
 */
async function authWrapper(): Promise<ResolvedSession | null> {
  if (isLocalMode()) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(LOCAL_AUTH_COOKIE)?.value;
      if (!token || !validateAuthToken(token)) return null;
      return buildLocalSession();
    } catch {
      return buildLocalSession();
    }
  }

  let accessToken: string | undefined;
  try {
    const cookieStore = await cookies();
    accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  } catch (err) {
    console.warn("[auth] auth(): cookies() threw:", err instanceof Error ? err.message : err);
    return null;
  }

  if (accessToken) {
    let payload = getCachedPayload(accessToken);
    if (!payload) {
      try {
        payload = await verifyAccessToken(accessToken);
        setCachedPayload(accessToken, payload);
      } catch (err) {
        console.warn(
          "[auth] auth(): n450s token verification failed, trying NextAuth session:",
          err instanceof Error ? err.message : err
        );
        return resolveNextAuthSession();
      }
    }
    const session = await resolveSessionFromPayload(payload);
    if (session) return session;
    console.warn(
      `[auth] auth(): resolveSessionFromPayload returned null for sub=${payload.sub}`
    );
  }

  return resolveNextAuthSession();
}

export {
  authWrapper as auth,
  nextAuthHandlers as handlers,
  signIn,
  signOut,
};
