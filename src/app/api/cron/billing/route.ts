import { NextRequest, NextResponse } from "next/server";
import { checkBillingPeriods } from "@/jobs/check-billing-periods";
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
    await checkBillingPeriods();
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("cron billing error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to check billing periods" } },
      { status: 500 }
    );
  }
}
