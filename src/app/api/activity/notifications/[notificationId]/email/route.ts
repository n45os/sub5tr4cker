import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, Notification } from "@/models";
import {
  buildEmailHtmlFromSavedParams,
  isValidSavedEmailParams,
} from "@/lib/notifications/rebuild-email-from-params";

type GroupLike = {
  admin: { toString: () => string };
  members: Array<{
    isActive?: boolean;
    leftAt?: Date | null;
    user?: { toString: () => string } | null;
    email: string;
  }>;
};

function canAccessGroup(
  group: GroupLike,
  userId: string,
  userEmail: string
): boolean {
  if (group.admin.toString() === userId) return true;
  return group.members.some(
    (m) =>
      m.isActive &&
      !m.leftAt &&
      (m.user?.toString() === userId || m.email === userEmail)
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
  if (!mongoose.isValidObjectId(notificationId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid notification id" } },
      { status: 400 }
    );
  }

  await dbConnect();

  const notification = await Notification.findById(notificationId).lean();
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

  const groupId = notification.group?.toString();
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

  const group = await Group.findById(groupId).lean();
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  const userId = session.user.id;
  const userEmail = (session.user.email as string) || "";
  if (!canAccessGroup(group as unknown as GroupLike, userId, userEmail)) {
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
