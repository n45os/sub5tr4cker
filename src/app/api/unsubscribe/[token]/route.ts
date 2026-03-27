import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/tokens";
import { sendAdminUnsubscribeNotification } from "@/lib/telegram/send";
import { getSetting } from "@/lib/settings/service";
import { db, type StorageGroupMember } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = await verifyUnsubscribeToken(token);
  const appUrl =
    (await getSetting("general.appUrl")) || new URL(_request.url).origin;

  if (!payload) {
    return NextResponse.redirect(new URL("/unsubscribed?error=invalid", appUrl));
  }

  const store = await db();

  const group = await store.getGroup(payload.groupId);
  if (!group || !group.isActive) {
    return NextResponse.redirect(new URL("/unsubscribed?error=not_found", appUrl));
  }

  const memberIndex = group.members.findIndex(
    (m: StorageGroupMember) => m.id === payload.memberId
  );
  if (memberIndex === -1) {
    return NextResponse.redirect(new URL("/unsubscribed?error=not_found", appUrl));
  }

  const memberBefore = group.members[memberIndex]!;
  const members = group.members.map((m, i) =>
    i === memberIndex ? { ...m, unsubscribedFromEmail: true } : m
  );
  await store.updateGroup(group.id, { members });

  const memberNickname = memberBefore.nickname;
  const memberEmail = memberBefore.email ?? "no email";
  const groupName = group.name;

  const admin = await store.getUser(group.adminId);
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
