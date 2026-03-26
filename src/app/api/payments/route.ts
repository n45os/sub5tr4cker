import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, isStorageId, type StorageMemberPayment } from "@/lib/storage";

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

  if (groupIdParam && !isStorageId(groupIdParam)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }

  if (statusFilter && !VALID_STATUSES.includes(statusFilter as PaymentStatus)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid status filter" } },
      { status: 400 }
    );
  }

  const store = await db();
  const adminId = session.user.id;
  const userEmail = (session.user.email as string) || "";

  const allForUser = await store.listGroupsForUser(adminId, userEmail);
  const groups = allForUser.filter((g) => g.adminId === adminId && g.isActive);
  const filteredGroups = groupIdParam ? groups.filter((g) => g.id === groupIdParam) : groups;

  const groupMap = new Map(filteredGroups.map((g) => [g.id, g.name]));

  if (filteredGroups.length === 0) {
    return NextResponse.json({
      data: {
        payments: [],
        groups: filteredGroups.map((g) => ({ _id: g.id, name: g.name })),
        pagination: { page: 1, totalPages: 0, total: 0 },
        summary: { totalCollected: 0, totalPending: 0, totalOverdue: 0 },
      },
    });
  }

  const rows: PaymentRow[] = [];
  for (const g of filteredGroups) {
    const periods = await store.getPeriodsForGroup(g.id);
    for (const period of periods) {
      const groupName = groupMap.get(period.groupId) ?? "—";
      for (const pay of period.payments as StorageMemberPayment[]) {
        if (statusFilter && pay.status !== statusFilter) continue;
        rows.push({
          _id: `${period.id}-${pay.id}`,
          periodId: period.id,
          periodLabel: period.periodLabel,
          periodStart: period.periodStart.toISOString(),
          groupId: period.groupId,
          groupName,
          memberId: pay.memberId,
          memberNickname: pay.memberNickname,
          memberEmail: pay.memberEmail,
          amount: pay.amount,
          currency: period.currency ?? "EUR",
          status: pay.status as PaymentStatus,
          memberConfirmedAt: pay.memberConfirmedAt ? pay.memberConfirmedAt.toISOString() : null,
          adminConfirmedAt: pay.adminConfirmedAt ? pay.adminConfirmedAt.toISOString() : null,
        });
      }
    }
  }

  rows.sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));

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
      groups: filteredGroups.map((g) => ({ _id: g.id, name: g.name })),
      pagination: { page, totalPages, total },
      summary,
    },
  });
}
