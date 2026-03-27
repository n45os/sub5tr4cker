import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGroupAccess } from "@/lib/authorization";
import { db, isStorageId } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );

  if (!groupId || !isStorageId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Valid groupId is required" } },
      { status: 400 }
    );
  }

  const store = await db();
  const group = await store.getGroup(groupId);

  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  const access = getGroupAccess(
    group,
    session.user.id,
    session.user.email || ""
  );
  if (!access) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not authorized to view notifications" } },
      { status: 403 }
    );
  }

  const notifications = await store.getNotificationsForGroup(groupId, limit);

  return NextResponse.json({
    data: {
      notifications: notifications.map((notification) => ({
        _id: notification.id,
        type: notification.type,
        channel: notification.channel,
        status: notification.status,
        subject: notification.subject,
        preview: notification.preview,
        recipientLabel: notification.recipientLabel,
        externalId: notification.externalId ?? null,
        deliveredAt: notification.deliveredAt,
        createdAt: notification.createdAt,
      })),
    },
  });
}
