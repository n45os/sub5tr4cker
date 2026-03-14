import { NextRequest, NextResponse } from "next/server";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";
import { getTaskCounts } from "@/lib/tasks/queue";
import { getSetting } from "@/lib/settings/service";

/**
 * Run the notification task worker (claim and execute due tasks).
 * Intended to be called frequently (e.g. every 5 min) by an external scheduler.
 * Response includes task counts by status for observability.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  const expectedSecret = await getSetting("security.cronSecret");
  if (secret !== expectedSecret) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    const result = await runNotificationTasks({ limit: 50 });
    const counts = await getTaskCounts();
    return NextResponse.json({
      data: {
        success: true,
        claimed: result.claimed,
        completed: result.completed,
        failed: result.failed,
        counts,
      },
    });
  } catch (error) {
    console.error("cron notification-tasks error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to run notification tasks" } },
      { status: 500 }
    );
  }
}
