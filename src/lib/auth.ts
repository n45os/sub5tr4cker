import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { MongoClient } from "mongodb";
import { compare } from "bcryptjs";
import { dbConnect } from "@/lib/db/mongoose";
import { User } from "@/models";
import { verifyMagicLoginToken } from "@/lib/tokens";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || (process.env.NODE_ENV === "development" ? "dev-secret-change-in-production" : undefined),
  adapter: MongoDBAdapter(getMongoClientPromise),
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
        await dbConnect();
        const email = (credentials.email as string).toLowerCase().trim();
        const user = await User.findOne({ email }).lean();
        if (!user) {
          console.warn("[auth] credentials: user not found");
          return null;
        }
        if (!user.hashedPassword) {
          console.warn("[auth] credentials: user has no password set");
          return null;
        }
        const match = await compare(
          credentials.password as string,
          user.hashedPassword
        );
        if (!match) {
          console.warn("[auth] credentials: password mismatch");
          return null;
        }
        return {
          id: String(user._id),
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
        await dbConnect();
        const user = await User.findById(payload.userId).lean();
        if (!user) {
          console.warn("[auth] magic-invite: user not found for id", payload.userId);
          return null;
        }
        return {
          id: String(user._id),
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
        await dbConnect();
        // load fresh user from DB so profile changes (e.g. email) are reflected
        const u = await User.findById(token.id).lean();
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
