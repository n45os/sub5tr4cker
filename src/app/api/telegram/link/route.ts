import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLinkToken } from "@/lib/tokens";
import { getBot } from "@/lib/telegram/bot";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Telegram is not configured" } },
      { status: 503 }
    );
  }

  try {
    const bot = getBot();
    const me = await bot.api.getMe();
    const username = me.username || "SubsTrackBot";
    const token = createLinkToken(session.user.id, 15);
    const baseUrl = "https://t.me";
    const deepLink = `${baseUrl}/${username}?start=link_${token}`;

    return NextResponse.json({
      data: {
        botUsername: username,
        deepLink,
      },
    });
  } catch (error) {
    console.error("telegram link error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate link" } },
      { status: 500 }
    );
  }
}
