import { runWorkerBatch } from "@/lib/tasks/worker";

const DEFAULT_BATCH_SIZE = 50;
const LOCK_TTL_MS = 5 * 60 * 1000;

/**
 * Claim and execute due notification tasks.
 * Uses a simple worker id (hostname + pid) and recovers stale locks.
 */
export async function runNotificationTasks(options?: {
  limit?: number;
}): Promise<{ claimed: number; completed: number; failed: number }> {
  const workerId =
    typeof process !== "undefined" && process.env.HOSTNAME
      ? `${process.env.HOSTNAME}:${process.pid}`
      : `worker:${process.pid}`;

  return runWorkerBatch(workerId, {
    limit: options?.limit ?? DEFAULT_BATCH_SIZE,
    lockTtlMs: LOCK_TTL_MS,
    recoverStaleLocks: true,
  });
}
