import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";

const updateNotificationsSchema = z
  .object({
    remindersEnabled: z.boolean().optional(),
    followUpsEnabled: z.boolean().optional(),
    priceChangeEnabled: z.boolean().optional(),
    saveEmailParams: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  if (!mongoose.isValidObjectId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }

  const parsed = updateNotificationsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
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

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can update notifications" } },
      { status: 403 }
    );
  }

  const body = parsed.data;

  if (body.remindersEnabled !== undefined) {
    group.notifications.remindersEnabled = body.remindersEnabled;
  }

  if (body.followUpsEnabled !== undefined) {
    group.notifications.followUpsEnabled = body.followUpsEnabled;
  }

  if (body.priceChangeEnabled !== undefined) {
    group.notifications.priceChangeEnabled = body.priceChangeEnabled;
    group.announcements.notifyOnPriceChange = body.priceChangeEnabled;
  }

  if (body.saveEmailParams !== undefined) {
    group.notifications.saveEmailParams = body.saveEmailParams;
  }

  await group.save();

  return NextResponse.json({
    data: {
      notifications: group.notifications,
    },
  });
}
