import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IMemberPayment } from "@/models";

export type PaymentStatus =
  | "pending"
  | "member_confirmed"
  | "confirmed"
  | "overdue"
  | "waived";

const VALID_STATUSES: PaymentStatus[] = [
  "pending",
  "member_confirmed",
  "confirmed",
  "overdue",
  "waived",
];

export interface PaymentRow {
  _id: string;
  periodId: string;
  periodLabel: string;
  periodStart: string;
  groupId: string;
  groupName: string;
  memberId: string;
  memberNickname: string;
  memberEmail: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  memberConfirmedAt: string | null;
  adminConfirmedAt: string | null;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const statusFilter = searchParams.get("status") || undefined;
  const groupIdParam = searchParams.get("groupId") || undefined;

  if (statusFilter && !VALID_STATUSES.includes(statusFilter as PaymentStatus)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid status filter" } },
      { status: 400 }
    );
  }

  await dbConnect();

  const adminId = session.user.id;
  const groupQuery: Record<string, unknown> = { admin: adminId, isActive: true };
  if (groupIdParam) {
    groupQuery._id = groupIdParam;
  }
  const groups = await Group.find(groupQuery).select("_id name").lean();
  const groupIds = groups.map((g) => g._id);
  const groupMap = new Map(groups.map((g) => [g._id.toString(), g.name]));

  if (groupIds.length === 0) {
    return NextResponse.json({
      data: {
        payments: [],
        groups: groups.map((g) => ({ _id: g._id.toString(), name: g.name })),
        pagination: { page: 1, totalPages: 0, total: 0 },
        summary: { totalCollected: 0, totalPending: 0, totalOverdue: 0 },
      },
    });
  }

  const periodQuery: Record<string, unknown> = { group: { $in: groupIds } };
  if (statusFilter) {
    periodQuery["payments.status"] = statusFilter;
  }

  const periods = await BillingPeriod.find(periodQuery)
    .sort({ periodStart: -1 })
    .lean();

  const rows: PaymentRow[] = [];
  for (const period of periods) {
    const groupName = groupMap.get(period.group.toString()) ?? "—";
    for (const pay of period.payments as IMemberPayment[]) {
      if (statusFilter && pay.status !== statusFilter) continue;
      rows.push({
        _id: `${period._id}-${pay._id}`,
        periodId: period._id.toString(),
        periodLabel: period.periodLabel,
        periodStart: period.periodStart.toISOString(),
        groupId: period.group.toString(),
        groupName,
        memberId: pay.memberId.toString(),
        memberNickname: pay.memberNickname,
        memberEmail: pay.memberEmail,
        amount: pay.amount,
        currency: period.currency ?? "EUR",
        status: pay.status as PaymentStatus,
        memberConfirmedAt: pay.memberConfirmedAt
          ? pay.memberConfirmedAt.toISOString()
          : null,
        adminConfirmedAt: pay.adminConfirmedAt
          ? pay.adminConfirmedAt.toISOString()
          : null,
      });
    }
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const payments = rows.slice(start, start + limit);

  const summary = {
    totalCollected: rows
      .filter((r) => r.status === "confirmed")
      .reduce((sum, r) => sum + r.amount, 0),
    totalPending: rows
      .filter((r) => r.status === "pending" || r.status === "member_confirmed")
      .reduce((sum, r) => sum + r.amount, 0),
    totalOverdue: rows
      .filter((r) => r.status === "overdue")
      .reduce((sum, r) => sum + r.amount, 0),
  };

  return NextResponse.json({
    data: {
      payments,
      groups: groups.map((g) => ({ _id: (g._id as { toString: () => string }).toString(), name: g.name })),
      pagination: { page, totalPages, total },
      summary,
    },
  });
}
