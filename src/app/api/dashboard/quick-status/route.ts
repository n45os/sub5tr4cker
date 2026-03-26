import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  aggregateOutstandingByGroupFromPeriods,
  buildAdminBillingSnapshot,
  getOpenOutstandingPeriods,
} from "@/lib/dashboard/billing-snapshot";
import { db } from "@/lib/storage";

// admin-only: aggregate quick status across all groups where user is admin
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const store = await db();

  const adminId = session.user.id;
  const now = new Date();

  const groups = (await store.listGroupsForUser(adminId, "")).filter(
    (group) => group.adminId === adminId && group.isActive
  );

  const adminGroupIds = groups.map((g) => g.id);

  const groupIds = groups.map((g) => g.id);
  const periods =
    groupIds.length === 0
      ? []
      : await getOpenOutstandingPeriods(store, groupIds, now);

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
