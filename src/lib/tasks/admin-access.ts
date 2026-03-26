import { db, type StorageScheduledTask } from "@/lib/storage";

/**
 * group ids where the user is admin (can manage scheduled notification tasks for those groups)
 */
export async function getGroupIdsWhereUserIsAdmin(
  userId: string
): Promise<string[]> {
  const store = await db();
  const groups = await store.listGroupsForUser(userId, "");
  return groups.filter((group) => group.adminId === userId).map((group) => group.id);
}

export function canUserManageTask(
  task: Pick<StorageScheduledTask, "payload">,
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
