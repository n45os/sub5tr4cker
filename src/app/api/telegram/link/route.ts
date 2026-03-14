import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { createLinkToken } from "@/lib/tokens";
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

  await dbConnect();
  const user = await User.findByIdAndUpdate(
    session.user.id,
    {
      $set: {
        "telegram.chatId": null,
        "telegram.username": null,
        "telegram.linkedAt": null,
        "notificationPreferences.telegram": false,
      },
    },
    { new: true }
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
    const linkToken = await createLinkToken(session.user.id, 15);
    const baseUrl = "https://t.me";
    const deepLink = `${baseUrl}/${username}?start=link_${linkToken}`;

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
