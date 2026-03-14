import { dbConnect } from "@/lib/db/mongoose";
import { User } from "@/models";

let ensured = false;

/**
 * Ensures at least one user has role "admin". If no admin exists, promotes the
 * earliest-created user. Safe to call repeatedly; runs at most once per process.
 */
export async function ensureInstanceAdmin(): Promise<void> {
  if (ensured) return;
  await dbConnect();
  const adminCount = await User.countDocuments({ role: "admin" });
  if (adminCount > 0) {
    ensured = true;
    return;
  }
  const oldest = await User.findOne().sort({ createdAt: 1 }).select("_id").lean();
  if (oldest) {
    await User.updateOne({ _id: oldest._id }, { $set: { role: "admin" } });
  }
  ensured = true;
}
