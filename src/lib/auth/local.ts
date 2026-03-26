import crypto from "crypto";
import { readConfig, updateConfig } from "@/lib/config/manager";

/** the fixed user id for the single local admin */
export const LOCAL_ADMIN_USER_ID = "local-admin";

/**
 * Generate a cryptographically random auth token and persist it in config.
 * Called once during 's54r init'.
 */
export function generateAndSaveAuthToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  updateConfig({ authToken: token });
  return token;
}

/**
 * Get the stored auth token from config.
 * Returns null if the config doesn't exist or has no token yet.
 */
export function getStoredAuthToken(): string | null {
  return readConfig()?.authToken ?? null;
}

/**
 * Validate a token against the stored auth token.
 * Constant-time comparison to prevent timing attacks.
 */
export function validateAuthToken(token: string): boolean {
  const stored = getStoredAuthToken();
  if (!stored) return false;
  if (token.length !== stored.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(stored));
}

/** cookie name used for local mode auth */
export const LOCAL_AUTH_COOKIE = "sub5tr4cker-local-auth";

/**
 * Build a synthetic session object for the local admin user.
 * This is returned by auth() in local mode.
 */
export function buildLocalSession() {
  const config = readConfig();
  return {
    user: {
      id: LOCAL_ADMIN_USER_ID,
      email: config?.adminEmail ?? "admin@localhost",
      name: config?.adminName ?? "Admin",
      role: "admin" as const,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
