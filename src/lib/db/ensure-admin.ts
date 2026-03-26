import { db } from "@/lib/storage";

let ensured = false;

/**
 * Ensures at least one user has role "admin". If no admin exists, promotes the
 * earliest-created user. Safe to call repeatedly; runs at most once per process.
 */
export async function ensureInstanceAdmin(): Promise<void> {
  if (ensured) return;
  const store = await db();
  const adminCount = await store.getAdminUserCount();
  if (adminCount > 0) {
    ensured = true;
    return;
  }
  await store.promoteOldestUserToAdmin();
  ensured = true;
}
