import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { User } from "@/models";
import { sendTelegramMessage } from "@/lib/telegram/send";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  await dbConnect();
  const user = await User.findById(session.user.id);

  if (!user?.telegram?.chatId) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Link your Telegram account first before sending a test message",
        },
      },
      { status: 400 }
    );
  }

  const messageId = await sendTelegramMessage({
    chatId: user.telegram.chatId,
    text:
      `🧪 <b>SubsTrack test message</b>\n\n` +
      `Your Telegram configuration is working and ready to send reminders.`,
  });

  if (!messageId) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to send the test Telegram message",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { success: true, messageId } });
}
