import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";
import type { IScheduledTask } from "@/models/scheduled-task";

/**
 * group ids where the user is admin (can manage scheduled notification tasks for those groups)
 */
export async function getGroupIdsWhereUserIsAdmin(
  userId: string
): Promise<string[]> {
  await dbConnect();
  const groups = await Group.find({ admin: userId }).select("_id").lean();
  return groups.map((g) => g._id.toString());
}

/**
 * mongo filter: task references at least one group the user admins
 */
export function buildScheduledTaskVisibilityFilter(
  adminGroupIds: string[]
): Record<string, unknown> {
  if (adminGroupIds.length === 0) {
    return { _id: { $exists: false } };
  }
  return {
    $or: [
      { "payload.groupId": { $in: adminGroupIds } },
      { "payload.payments.groupId": { $in: adminGroupIds } },
    ],
  };
}

export function canUserManageTask(
  task: Pick<IScheduledTask, "payload">,
  adminGroupIds: Set<string>
): boolean {
  const payload = task.payload as {
    groupId?: string;
    payments?: Array<{ groupId?: string }>;
  };
  if (payload.groupId && adminGroupIds.has(payload.groupId)) {
    return true;
  }
  if (payload.payments?.length) {
    return payload.payments.some(
      (p) => p.groupId && adminGroupIds.has(p.groupId)
    );
  }
  return false;
}
