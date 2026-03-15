import { dbConnect } from "@/lib/db/mongoose";
import {
  ScheduledTask,
  type ScheduledTaskType,
  type IScheduledTaskPayload,
} from "@/models/scheduled-task";
import type { IScheduledTask } from "@/models/scheduled-task";
import { buildIdempotencyKey } from "./idempotency";

const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_BATCH_SIZE = 50;

export interface EnqueueInput {
  type: ScheduledTaskType;
  runAt: Date;
  payload: IScheduledTaskPayload;
  maxAttempts?: number;
}

/**
 * Enqueue a task if no task with the same idempotency key exists.
 * Returns the created task, or null if a task with the same idempotency key already exists.
 */
export async function enqueueTask(
  input: EnqueueInput
): Promise<InstanceType<typeof ScheduledTask> | null> {
  await dbConnect();

  const idempotencyKey = buildIdempotencyKey(
    input.type,
    input.payload,
    input.runAt
  );

  const existing = await ScheduledTask.findOne({ idempotencyKey });
  if (existing) return null;

  const created = await ScheduledTask.create({
    type: input.type,
    status: "pending",
    runAt: input.runAt,
    payload: input.payload,
    idempotencyKey,
    maxAttempts: input.maxAttempts ?? 5,
  });
  return created;
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
): Promise<InstanceType<typeof ScheduledTask>[]> {
  await dbConnect();

  const limit = options.limit ?? DEFAULT_BATCH_SIZE;
  const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - lockTtlMs);

  if (options.recoverStaleLocks) {
    await ScheduledTask.updateMany(
      {
        status: "locked",
        lockedAt: { $lt: staleThreshold },
      },
      {
        $set: { status: "pending", lockedAt: null, lockedBy: null },
      }
    );
  }

  const tasks: InstanceType<typeof ScheduledTask>[] = [];
  const cursor = ScheduledTask.find({
    status: "pending",
    runAt: { $lte: now },
  })
    .sort({ runAt: 1 })
    .limit(limit)
    .cursor();

  for await (const task of cursor) {
    const updated = await ScheduledTask.findOneAndUpdate(
      { _id: task._id, status: "pending" },
      {
        $set: {
          status: "locked",
          lockedAt: now,
          lockedBy: workerId,
        },
      },
      { returnDocument: "after" }
    );
    if (updated) tasks.push(updated);
  }

  return tasks;
}

/**
 * Mark task as completed and clear lock.
 */
export async function completeTask(
  task: IScheduledTask
): Promise<InstanceType<typeof ScheduledTask> | null> {
  await dbConnect();
  return ScheduledTask.findByIdAndUpdate(
    task._id,
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    },
    { returnDocument: "after" }
  );
}

/**
 * Record failure and either retry (with backoff) or mark failed.
 */
export async function failTask(
  task: IScheduledTask,
  error: unknown
): Promise<InstanceType<typeof ScheduledTask> | null> {
  await dbConnect();

  const errMessage =
    error instanceof Error ? error.message : String(error);
  const attempts = (task.attempts ?? 0) + 1;
  const maxAttempts = task.maxAttempts ?? 5;

  if (attempts >= maxAttempts) {
    return ScheduledTask.findByIdAndUpdate(
      task._id,
      {
        $set: {
          status: "failed",
          lastError: errMessage,
          attempts,
          lockedAt: null,
          lockedBy: null,
        },
      },
      { returnDocument: "after" }
    );
  }

  // exponential backoff: 2^attempts minutes
  const backoffMs = Math.min(
    2 ** attempts * 60 * 1000,
    24 * 60 * 60 * 1000
  );
  const runAt = new Date(Date.now() + backoffMs);

  return ScheduledTask.findByIdAndUpdate(
    task._id,
    {
      $set: {
        status: "pending",
        runAt,
        lastError: errMessage,
        attempts,
        lockedAt: null,
        lockedBy: null,
      },
    },
    { returnDocument: "after" }
  );
}

/**
 * Release a locked task back to pending (e.g. worker shutting down).
 */
export async function releaseTask(
  task: IScheduledTask
): Promise<InstanceType<typeof ScheduledTask> | null> {
  await dbConnect();
  return ScheduledTask.findByIdAndUpdate(
    task._id,
    {
      $set: {
        status: "pending",
        lockedAt: null,
        lockedBy: null,
      },
    },
    { returnDocument: "after" }
  );
}

export async function getTaskCounts(): Promise<{
  pending: number;
  locked: number;
  completed: number;
  failed: number;
}> {
  await dbConnect();
  const [pending, locked, completed, failed] = await Promise.all([
    ScheduledTask.countDocuments({ status: "pending" }),
    ScheduledTask.countDocuments({ status: "locked" }),
    ScheduledTask.countDocuments({ status: "completed" }),
    ScheduledTask.countDocuments({ status: "failed" }),
  ]);
  return { pending, locked, completed, failed };
}
