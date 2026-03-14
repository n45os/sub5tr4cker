import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/tokens";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, User } from "@/models";
import { sendAdminUnsubscribeNotification } from "@/lib/telegram/send";
import { getSetting } from "@/lib/settings/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = await verifyUnsubscribeToken(token);
  const appUrl =
    (await getSetting("general.appUrl")) || new URL(_request.url).origin;

  if (!payload) {
    return NextResponse.redirect(
      new URL("/unsubscribed?error=invalid", appUrl)
    );
  }

  await dbConnect();

  const group = await Group.findById(payload.groupId);
  if (!group || !group.isActive) {
    return NextResponse.redirect(
      new URL("/unsubscribed?error=not_found", appUrl)
    );
  }

  const member = group.members.find(
    (m: { _id: { toString: () => string } }) => m._id.toString() === payload.memberId
  );
  if (!member) {
    return NextResponse.redirect(
      new URL("/unsubscribed?error=not_found", appUrl)
    );
  }

  member.unsubscribedFromEmail = true;
  await group.save();

  const memberNickname = member.nickname;
  const memberEmail = member.email;
  const groupName = group.name;

  // notify admin via Telegram
  const admin = await User.findById(group.admin);
  if (admin?.telegram?.chatId) {
    await sendAdminUnsubscribeNotification(
      admin.telegram.chatId,
      memberNickname,
      memberEmail,
      groupName
    );
  }

  return NextResponse.redirect(new URL("/unsubscribed?done=1", appUrl));
}
