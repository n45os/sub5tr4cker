import { NextRequest, NextResponse } from "next/server";
import { sendFollowUps } from "@/jobs/send-follow-ups";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";
import { getSetting } from "@/lib/settings/service";

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
    const result = await sendFollowUps();
    const workerResult = await runNotificationTasks({ limit: 50 });
    return NextResponse.json({
      data: {
        success: true,
        overdueReconciled: result.overdueReconciled,
        adminNudgesEnqueued: result.adminNudgesEnqueued,
        worker: workerResult,
      },
    });
  } catch (error) {
    console.error("cron follow-ups error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to run follow-ups" } },
      { status: 500 }
    );
  }
}
