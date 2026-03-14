import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";

export async function POST(request: NextRequest) {
  const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && secretToken !== expected) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid webhook secret" } },
      { status: 401 }
    );
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Telegram not configured" } },
      { status: 500 }
    );
  }

  try {
    const update = await request.json();
    const bot = getBot();
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
