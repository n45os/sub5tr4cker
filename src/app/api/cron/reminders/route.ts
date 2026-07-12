import { NextRequest, NextResponse } from "next/server";
import { enqueueReminders } from "@/jobs/enqueue-reminders";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";
import { getSetting } from "@/lib/settings/service";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  const expectedSecret = await getSetting("security.cronSecret");
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    const enqueued = await enqueueReminders();
    const workerResult = await runNotificationTasks({ limit: 50 });
    return NextResponse.json({
      data: {
        success: true,
        enqueued,
        worker: workerResult,
      },
    });
  } catch (error) {
    console.error("cron reminders error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to enqueue/run reminders" } },
      { status: 500 }
    );
  }
}
