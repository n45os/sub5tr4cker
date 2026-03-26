import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getGroupIdsWhereUserIsAdmin } from "@/lib/tasks/admin-access";
import { db, type StorageScheduledTask } from "@/lib/storage";

const TYPES: StorageScheduledTask["type"][] = [
  "payment_reminder",
  "aggregated_payment_reminder",
  "admin_confirmation_request",
];

const bodySchema = z
  .object({
    groupId: z.string().optional(),
    memberEmail: z.string().trim().min(1).optional(),
    type: z.enum(TYPES as [StorageScheduledTask["type"], ...StorageScheduledTask["type"][]]).optional(),
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

  const store = await db();
  const cancelled = await store.bulkCancelPendingTasksForAdmin({
    adminGroupIds,
    groupId,
    memberEmail,
    type,
  });

  return NextResponse.json({
    data: { cancelled },
  });
}
