import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";
import { getSetting } from "@/lib/settings/service";

export async function POST(request: NextRequest) {
  const secretToken = request.headers.get("x-telegram-bot-api-secret-token");

  let expected: string | null = null;
  try {
    expected = await getSetting("telegram.webhookSecret");
  } catch (error) {
    console.error("telegram webhook settings read failed (webhook secret):", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Could not read Telegram webhook configuration",
        },
      },
      { status: 500 }
    );
  }

  if (expected && secretToken !== expected) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid webhook secret" } },
      { status: 401 }
    );
  }

  let token: string | null = null;
  try {
    token = await getSetting("telegram.botToken");
  } catch (error) {
    console.error("telegram webhook settings read failed (bot token):", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Could not read Telegram bot configuration",
        },
      },
      { status: 500 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Telegram not configured" } },
      { status: 500 }
    );
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  try {
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
