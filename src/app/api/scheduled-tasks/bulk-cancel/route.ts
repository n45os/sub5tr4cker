import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { ScheduledTask } from "@/models";
import type { ScheduledTaskType } from "@/models/scheduled-task";
import {
  buildScheduledTaskVisibilityFilter,
  getGroupIdsWhereUserIsAdmin,
} from "@/lib/tasks/admin-access";

const TYPES: ScheduledTaskType[] = [
  "payment_reminder",
  "aggregated_payment_reminder",
  "admin_confirmation_request",
  "price_change",
  "invite",
  "follow_up",
];

const bodySchema = z
  .object({
    groupId: z.string().optional(),
    memberEmail: z.string().trim().min(1).optional(),
    type: z.enum(TYPES as [ScheduledTaskType, ...ScheduledTaskType[]]).optional(),
  })
  .refine((d) => !!(d.groupId || d.memberEmail || d.type), {
    message: "provide at least one of groupId, memberEmail, or type",
  });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.flatten().formErrors.join(", ") || "Invalid body",
        },
      },
      { status: 400 }
    );
  }

  const adminGroupIds = await getGroupIdsWhereUserIsAdmin(session.user.id);
  if (adminGroupIds.length === 0) {
    return NextResponse.json({
      data: { cancelled: 0 },
    });
  }

  const { groupId, memberEmail, type } = parsed.data;

  if (groupId && !adminGroupIds.includes(groupId)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not an admin of this group" } },
      { status: 403 }
    );
  }

  await dbConnect();

  const visibility = buildScheduledTaskVisibilityFilter(adminGroupIds);
  const and: Record<string, unknown>[] = [visibility];

  if (groupId) {
    and.push({
      $or: [
        { "payload.groupId": groupId },
        { "payload.payments.groupId": groupId },
      ],
    });
  }

  if (memberEmail) {
    const trimmed = memberEmail.trim();
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    and.push({
      "payload.memberEmail": {
        $regex: new RegExp(`^${escaped}$`, "i"),
      },
    });
  }

  if (type) {
    and.push({ type });
  }

  const filter = {
    status: { $in: ["pending", "locked"] as const },
    $and: and,
  };

  const result = await ScheduledTask.updateMany(filter, {
    $set: {
      status: "cancelled",
      cancelledAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });

  return NextResponse.json({
    data: { cancelled: result.modifiedCount },
  });
}
