import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBot } from "@/lib/telegram/bot";
import { getSetting } from "@/lib/settings/service";
import { db } from "@/lib/storage";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const store = await db();
    const existing = await store.getUser(session.user.id);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    await store.updateUser(session.user.id, {
      telegram: null,
      notificationPreferences: {
        ...existing.notificationPreferences,
        telegram: false,
      },
    });

    return NextResponse.json({
      data: { unlinked: true },
    });
  } catch (error) {
    console.error("telegram unlink error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to unlink Telegram" } },
      { status: 500 }
    );
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const token = await getSetting("telegram.botToken");
  if (!token) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Telegram is not configured" } },
      { status: 503 }
    );
  }

  try {
    const bot = await getBot();
    const me = await bot.api.getMe();
    const username = me.username || "sub5tr4ckerBot";
    const code = crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const store = await db();
    await store.updateUser(session.user.id, {
      telegramLinkCode: { code, expiresAt },
    });

    const deepLink = `https://t.me/${username}?start=link_${code}`;

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
