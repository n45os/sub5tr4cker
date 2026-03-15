import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
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

  const groupIds = groups.map((g) => g._id);

  const periods = await BillingPeriod.find({
    group: { $in: groupIds },
    isFullyPaid: false,
    periodStart: { $lt: now },
    "payments.status": { $in: ["pending", "overdue", "member_confirmed"] },
  })
    .lean()
    .exec();

  const totalGroups = groups.length;
  let groupsWithPendingOverdue = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let memberConfirmedCount = 0;

  const groupHasUnpaid = new Set<string>();

  for (const period of periods) {
    const gid = (period.group as { toString: () => string }).toString();
    const payments = (period.payments ?? []) as Array<{ status: string }>;
    for (const p of payments) {
      if (p.status === "pending") {
        pendingCount += 1;
        groupHasUnpaid.add(gid);
      } else if (p.status === "overdue") {
        overdueCount += 1;
        groupHasUnpaid.add(gid);
      } else if (p.status === "member_confirmed") {
        memberConfirmedCount += 1;
        groupHasUnpaid.add(gid);
      }
    }
  }

  groupsWithPendingOverdue = groupHasUnpaid.size;

  return NextResponse.json({
    data: {
      totalGroups,
      groupsWithPendingOverdue,
      pendingCount,
      overdueCount,
      memberConfirmedCount,
    },
  });
}
