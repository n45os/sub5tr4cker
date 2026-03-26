import { db, type StorageScheduledTask, type StorageTaskPayload, type StorageTaskType } from "@/lib/storage";
import { buildIdempotencyKey } from "./idempotency";

const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_BATCH_SIZE = 50;

export interface EnqueueInput {
  type: StorageTaskType;
  runAt: Date;
  payload: StorageTaskPayload;
  maxAttempts?: number;
}

/**
 * Enqueue a task if no task with the same idempotency key exists.
 * Returns the created task, or null if a task with the same idempotency key already exists.
 */
export async function enqueueTask(
  input: EnqueueInput
): Promise<StorageScheduledTask | null> {
  const store = await db();

  const idempotencyKey = buildIdempotencyKey(
    input.type,
    input.payload,
    input.runAt
  );

  return store.enqueueTask({
    type: input.type,
    runAt: input.runAt,
    payload: input.payload,
    idempotencyKey,
    maxAttempts: input.maxAttempts ?? 5,
  });
}

/**
 * Claim up to `limit` due pending tasks for this worker.
 * Optionally reclaim stale locks (locked longer than lockTtlMs).
 */
export async function claimTasks(
  workerId: string,
  options: {
    limit?: number;
    lockTtlMs?: number;
    recoverStaleLocks?: boolean;
  } = {}
): Promise<StorageScheduledTask[]> {
  const store = await db();
  return store.claimTasks(workerId, {
    limit: options.limit ?? DEFAULT_BATCH_SIZE,
    lockTtlMs: options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS,
    recoverStaleLocks: options.recoverStaleLocks,
  });
}

/**
 * Mark task as completed and clear lock.
 */
export async function completeTask(
  task: Pick<StorageScheduledTask, "id">
): Promise<void> {
  const store = await db();
  await store.completeTask(task.id);
}

/**
 * Record failure and either retry (with backoff) or mark failed.
 */
export async function failTask(
  task: Pick<StorageScheduledTask, "id" | "attempts" | "maxAttempts">,
  error: unknown
): Promise<void> {
  const errMessage =
    error instanceof Error ? error.message : String(error);
  const attempts = (task.attempts ?? 0) + 1;
  const maxAttempts = task.maxAttempts ?? 5;
  const store = await db();
  await store.failTask(task.id, errMessage, attempts, maxAttempts);
}

/**
 * Release a locked task back to pending (e.g. worker shutting down).
 */
export async function releaseTask(
  task: Pick<StorageScheduledTask, "id">
): Promise<void> {
  const store = await db();
  await store.releaseTask(task.id);
}

export async function getTaskCounts(): Promise<{
  pending: number;
  locked: number;
  completed: number;
  failed: number;
  cancelled: number;
}> {
  const store = await db();
  return store.getTaskCounts();
}
