import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, isStorageId } from "@/lib/storage";
import type { StorageGroup } from "@/lib/storage/types";
import {
  buildEmailHtmlFromSavedParams,
  isValidSavedEmailParams,
} from "@/lib/notifications/rebuild-email-from-params";

function canAccessGroup(
  group: StorageGroup,
  userId: string,
  userEmail: string
): boolean {
  if (group.adminId === userId) return true;
  return group.members.some(
    (m) =>
      m.isActive &&
      !m.leftAt &&
      (m.userId === userId ||
        m.email.toLowerCase() === userEmail.toLowerCase())
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { notificationId } = await context.params;
  if (!isStorageId(notificationId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid notification id" } },
      { status: 400 }
    );
  }

  const store = await db();

  const notification = await store.getNotificationById(notificationId);
  if (!notification) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Notification not found" } },
      { status: 404 }
    );
  }

  if (notification.channel !== "email") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Only email notifications can be previewed",
        },
      },
      { status: 400 }
    );
  }

  const groupId = notification.groupId ?? null;
  if (!groupId) {
    return NextResponse.json(
      {
        data: {
          unavailable: true,
          reason:
            "This notification has no group; email preview is not available.",
        },
      },
      { status: 200 }
    );
  }

  const group = await store.getGroup(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  const userId = session.user.id;
  const userEmail = (session.user.email as string) || "";
  if (!canAccessGroup(group, userId, userEmail)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Access denied" } },
      { status: 403 }
    );
  }

  const rawParams = notification.emailParams;
  if (rawParams == null || !isValidSavedEmailParams(rawParams)) {
    return NextResponse.json({
      data: {
        unavailable: true,
        reason:
          "Email data was not saved for this notification. Enable “Save email data for activity preview” on the group to capture future sends.",
      },
    });
  }

  try {
    const html = buildEmailHtmlFromSavedParams(rawParams);
    return NextResponse.json({ data: { html } });
  } catch (e) {
    console.error("rebuild email from saved params failed:", e);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Could not rebuild email from saved data",
        },
      },
      { status: 500 }
    );
  }
}
