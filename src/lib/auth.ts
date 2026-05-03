import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { MongoClient } from "mongodb";
import { compare } from "bcryptjs";
import { verifyMagicLoginToken } from "@/lib/tokens";
import { isLocalMode } from "@/lib/config/manager";
import { buildLocalSession, validateAuthToken, LOCAL_AUTH_COOKIE } from "@/lib/auth/local";
import { cookies } from "next/headers";
import { db } from "@/lib/storage";
import { ACCESS_COOKIE } from "@/lib/auth/n450s/session-cookies";
import { verifyAccessToken } from "@/lib/auth/n450s/jwks";
import { getCachedPayload, setCachedPayload } from "@/lib/auth/n450s/payload-cache";
import { resolveSessionFromPayload, type ResolvedSession } from "@/lib/auth/n450s/session-resolver";

let clientPromise: Promise<MongoClient> | null = null;

function getMongoClientPromise(): Promise<MongoClient> {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/substrack";
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

// 30 days in seconds — persistent session so cookie is shared across tabs
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const isLocalAuthMode = isLocalMode();

// nextAuth() itself is no longer called by auth() in advanced mode — the
// `handlers` export remains so the legacy /api/auth/[...nextauth] route keeps
// responding until phase 6 stubs it to 410.
const {
  handlers: nextAuthHandlers,
  signIn,
  signOut,
} = NextAuth({
  trustHost: true,
  secret:
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "development" ? "dev-secret-change-in-production" : undefined),
  adapter: isLocalAuthMode ? undefined : MongoDBAdapter(getMongoClientPromise()),
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
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn("[auth] credentials: missing email or password");
          return null;
        }
        const store = await db();
        const email = (credentials.email as string).toLowerCase().trim();
        const user = await store.getUserByEmail(email);
        if (!user) {
          console.warn("[auth] credentials: user not found");
          return null;
        }
        if (!user.hashedPassword) {
          console.warn("[auth] credentials: user has no password set");
          return null;
        }
        const match = await compare(credentials.password as string, user.hashedPassword);
        if (!match) {
          console.warn("[auth] credentials: password mismatch");
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role ?? "user",
        };
      },
    }),
    CredentialsProvider({
      id: "magic-invite",
      name: "magic-invite",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token;
        if (typeof token !== "string" || !token) {
          console.warn("[auth] magic-invite: missing or invalid token in credentials");
          return null;
        }
        const payload = await verifyMagicLoginToken(token);
        if (!payload) {
          console.warn("[auth] magic-invite: token invalid or expired");
          return null;
        }
        const store = await db();
        const user = await store.getUser(payload.userId);
        if (!user) {
          console.warn("[auth] magic-invite: user not found for id", payload.userId);
          return null;
        }
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
        }
      }
      return session;
    },
  },
});

/**
 * auth() wrapper.
 * - local mode: returns the synthetic local admin session when the auth cookie
 *   is valid (or when called outside a request context, e.g. cron scripts).
 * - advanced mode: reads the n450s_auth access-token cookie, verifies it
 *   (re-using the request-scoped payload cache populated by middleware), and
 *   maps the payload to the canonical session shape. returns null on any
 *   failure — no fallback to NextAuth.
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
    // cookies() unavailable outside a request — no session to resolve
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

export { authWrapper as auth, nextAuthHandlers as handlers, signIn, signOut };
