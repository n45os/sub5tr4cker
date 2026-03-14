import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { getBot } from "@/lib/telegram/bot";
import { getSetting } from "@/lib/settings/service";
import { User } from "@/models";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    await dbConnect();
    // use $unset so sparse unique index on telegram.chatId doesn't get duplicate null
    const user = await User.findByIdAndUpdate(
      session.user.id,
      {
        $unset: {
          "telegram.chatId": "",
          "telegram.username": "",
          "telegram.linkedAt": "",
        },
        $set: { "notificationPreferences.telegram": false },
      },
      { returnDocument: "after" }
    ).lean();

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

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
    // Telegram start param allows only A-Za-z0-9_ and max 64 chars; use short code
    const code = crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await dbConnect();
    await User.findByIdAndUpdate(session.user.id, {
      $set: { telegramLinkCode: { code, expiresAt } },
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
