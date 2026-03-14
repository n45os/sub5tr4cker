import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";
import { getSetting } from "@/lib/settings/service";

export async function POST(request: NextRequest) {
  const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
  const expected = await getSetting("telegram.webhookSecret");
  if (expected && secretToken !== expected) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid webhook secret" } },
      { status: 401 }
    );
  }

  const token = await getSetting("telegram.botToken");
  if (!token) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Telegram not configured" } },
      { status: 500 }
    );
  }

  try {
    const update = await request.json();
    const bot = await getBot();
    await bot.handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("telegram webhook error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Webhook handler failed" } },
      { status: 500 }
    );
  }
}
