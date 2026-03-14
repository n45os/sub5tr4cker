import { NextRequest, NextResponse } from "next/server";
import { sendFollowUps } from "@/jobs/send-follow-ups";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    await sendFollowUps();
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("cron follow-ups error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to send follow-ups" } },
      { status: 500 }
    );
  }
}
