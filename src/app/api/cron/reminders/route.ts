import { NextRequest, NextResponse } from "next/server";
import { sendReminders } from "@/jobs/send-reminders";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    await sendReminders();
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("cron reminders error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to send reminders" } },
      { status: 500 }
    );
  }
}
