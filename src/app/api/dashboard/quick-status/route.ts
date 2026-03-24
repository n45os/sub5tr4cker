import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import {
  aggregateOutstandingByGroupFromPeriods,
  buildAdminBillingSnapshot,
  buildOpenOutstandingPeriodsQuery,
} from "@/lib/dashboard/billing-snapshot";
import { BillingPeriod, Group } from "@/models";

// admin-only: aggregate quick status across all groups where user is admin
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  await dbConnect();

  const adminId = session.user.id;
  const now = new Date();

  const groups = await Group.find({
    admin: adminId,
    isActive: true,
  })
    .lean()
    .exec();

  const adminGroupIds = groups.map((g) => g._id.toString());

  const groupIds = groups.map((g) => g._id);
  const periods =
    groupIds.length === 0
      ? []
      : await BillingPeriod.find(buildOpenOutstandingPeriodsQuery(groupIds, now))
          .lean()
          .exec();

  const byGroup = aggregateOutstandingByGroupFromPeriods(periods);
  const snapshot = buildAdminBillingSnapshot(adminGroupIds, byGroup);

  return NextResponse.json({
    data: {
      totalGroups: snapshot.totalGroups,
      groupsNeedingAttention: snapshot.groupsNeedingAttention,
      groupsEligibleForReminders: snapshot.groupsEligibleForReminders,
      pendingCount: snapshot.pendingCount,
      overdueCount: snapshot.overdueCount,
      memberConfirmedCount: snapshot.memberConfirmedCount,
      // deprecated alias for older clients — same value as groupsNeedingAttention
      groupsWithPendingOverdue: snapshot.groupsNeedingAttention,
    },
  });
}
