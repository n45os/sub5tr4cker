import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { recalculateEqualSplitPeriodsForGroup } from "@/lib/billing/backfill";
import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";

// admin-only: re-run equal/variable shares for every billing period (fixes orphan
// rows and stale amounts after roster or split-rule changes)
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 },
    );
  }

  const { groupId } = await context.params;
  if (!mongoose.isValidObjectId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 },
    );
  }

  await dbConnect();
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 },
    );
  }

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can reconcile billing" } },
      { status: 403 },
    );
  }

  const { periodsUpdated } = await recalculateEqualSplitPeriodsForGroup(group);

  return NextResponse.json({
    data: {
      periodsUpdated,
    },
  });
}
