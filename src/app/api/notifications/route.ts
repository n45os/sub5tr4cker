import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { isInstanceAdmin } from "@/lib/authorization";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, Notification } from "@/models";
import type { IGroupMember } from "@/models";

function canAccessGroup(
  group: InstanceType<typeof Group>,
  userId: string,
  userEmail: string
) {
  if (group.admin.toString() === userId) {
    return true;
  }

  return group.members.some(
    (member: IGroupMember) =>
      member.isActive &&
      !member.leftAt &&
      (member.user?.toString() === userId || member.email === userEmail)
  );
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }
  if (!isInstanceAdmin(session)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only admins can view notifications" } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );

  if (!groupId || !mongoose.isValidObjectId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Valid groupId is required" } },
      { status: 400 }
    );
  }

  await dbConnect();
  const group = await Group.findById(groupId);

  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  const allowed = canAccessGroup(
    group,
    session.user.id,
    session.user.email || ""
  );

  if (!allowed) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not authorized to view notifications" } },
      { status: 403 }
    );
  }

  const notifications = await Notification.find({ group: groupId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return NextResponse.json({
    data: {
      notifications: notifications.map((notification) => ({
        _id: notification._id.toString(),
        type: notification.type,
        channel: notification.channel,
        status: notification.status,
        subject: notification.subject,
        preview: notification.preview,
        recipientEmail: notification.recipientEmail,
        externalId: notification.externalId ?? null,
        deliveredAt: notification.deliveredAt,
        createdAt: notification.createdAt,
      })),
    },
  });
}
