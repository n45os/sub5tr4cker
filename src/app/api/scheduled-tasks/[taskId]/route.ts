import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { ScheduledTask } from "@/models";
import {
  canUserManageTask,
  getGroupIdsWhereUserIsAdmin,
} from "@/lib/tasks/admin-access";

const patchSchema = z.object({
  action: z.enum(["cancel", "retry"]),
});

type RouteContext = { params: Promise<{ taskId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { taskId } = await context.params;
  if (!mongoose.isValidObjectId(taskId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid task id" } },
      { status: 400 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "action must be cancel or retry",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  await dbConnect();
  const task = await ScheduledTask.findById(taskId).exec();
  if (!task) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 }
    );
  }

  const adminGroupIds = await getGroupIdsWhereUserIsAdmin(session.user.id);
  const adminSet = new Set(adminGroupIds);
  if (!canUserManageTask(task, adminSet)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not allowed to manage this task" } },
      { status: 403 }
    );
  }

  const { action } = parsed.data;

  if (action === "cancel") {
    if (task.status !== "pending" && task.status !== "locked") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Only pending or locked tasks can be cancelled",
          },
        },
        { status: 400 }
      );
    }
    task.status = "cancelled";
    task.cancelledAt = new Date();
    task.lockedAt = null;
    task.lockedBy = null;
    await task.save();
    return NextResponse.json({
      data: {
        task: {
          _id: task._id.toString(),
          status: task.status,
          cancelledAt: task.cancelledAt?.toISOString() ?? null,
        },
      },
    });
  }

  // retry
  if (task.status !== "failed") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Only failed tasks can be retried",
        },
      },
      { status: 400 }
    );
  }
  task.status = "pending";
  task.runAt = new Date();
  task.attempts = 0;
  task.lastError = null;
  task.lockedAt = null;
  task.lockedBy = null;
  task.completedAt = null;
  await task.save();

  return NextResponse.json({
    data: {
      task: {
        _id: task._id.toString(),
        status: task.status,
        runAt: task.runAt.toISOString(),
        attempts: task.attempts,
      },
    },
  });
}
