import { randomBytes } from "crypto";

const DEFAULT_LENGTH = 12;
const MAX_RETRIES = 5;

/**
 * Generate a URL-safe random invite code (base64url, no padding).
 * Suitable for use in /invite/[code] paths.
 */
export function generateInviteCode(length: number = DEFAULT_LENGTH): string {
  const bytes = randomBytes(Math.ceil((length * 3) / 4));
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .slice(0, length);
}

/**
 * Try to generate a unique invite code by checking existence with the given checker.
 * Retries up to MAX_RETRIES on collision.
 */
export async function generateUniqueInviteCode(
  exists: (code: string) => Promise<boolean>,
  length: number = DEFAULT_LENGTH
): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateInviteCode(length);
    const taken = await exists(code);
    if (!taken) return code;
  }
  throw new Error("Failed to generate unique invite code after retries");
}
