import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sendMemberAddedNotifications } from "@/lib/notifications/service";
import { db, isStorageId } from "@/lib/storage";

const notifyMemberAddedSchema = z.object({
  newMemberId: z.string().optional(),
  newMemberNickname: z.string().min(1),
  newShareAmount: z.number().nonnegative(),
  currency: z.string().length(3),
  changeType: z.enum(["added", "removed"]).optional(),
  creditSummary: z.array(
    z.object({
      memberId: z.string(),
      memberNickname: z.string(),
        memberEmail: z.string().nullable(),
      totalCredit: z.number(),
      periods: z.array(
        z.object({
          periodId: z.string(),
          periodLabel: z.string(),
          oldAmount: z.number(),
          newAmount: z.number(),
          credit: z.number(),
        })
      ),
    })
  ),
});

export async function POST(
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
  if (!isStorageId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }

  const parsed = notifyMemberAddedSchema.safeParse(await request.json());
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

  const store = await db();

  const group = await store.getGroup(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.adminId !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can notify members" } },
      { status: 403 }
    );
  }

  const {
    newMemberId: bodyNewMemberId,
    newMemberNickname,
    newShareAmount,
    currency,
    changeType,
    creditSummary,
  } = parsed.data;

  let newMemberId = bodyNewMemberId ?? "";
  if (!newMemberId && group.members.length > 0) {
    const lastActive = [...group.members].reverse().find((m) => m.isActive && !m.leftAt);
    if (lastActive) newMemberId = lastActive.id;
  }

  try {
    await sendMemberAddedNotifications(group, {
      newMemberId,
      newMemberNickname,
      newShareAmount,
      currency,
      changeType: changeType ?? "added",
      creditSummary,
    });
  } catch (error) {
    console.error("notify-member-added failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to send notifications" } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { sent: true },
  });
}
