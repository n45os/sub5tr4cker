import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IGroupMember, IMemberPayment } from "@/models";
import {
  calculateShares,
  formatPeriodLabel,
  getPeriodDates,
} from "@/lib/billing/calculator";
import { createConfirmationToken } from "@/lib/tokens";

const createPeriodSchema = z.object({
  periodLabel: z.string().min(1).max(50),
  totalPrice: z.number().positive(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00.000Z");
  return new Date(s);
}

export async function GET(
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

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));
  const statusFilter = searchParams.get("status") || undefined;

  await dbConnect();

  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  const isAdmin = group.admin.toString() === session.user.id;
  const isMember = group.members.some(
    (m: IGroupMember) =>
      m.isActive &&
      !m.leftAt &&
      (m.user?.toString() === session.user.id || m.email === session.user.email)
  );
  if (!isAdmin && !isMember) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not authorized to view this group" } },
      { status: 403 }
    );
  }

  const query: Record<string, unknown> = { group: groupId };
  if (statusFilter) {
    query["payments.status"] = statusFilter;
  }

  const total = await BillingPeriod.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const periods = await BillingPeriod.find(query)
    .sort({ periodStart: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
    .exec();

  type PeriodDoc = {
    _id: { toString: () => string };
    periodLabel: string;
    totalPrice: number;
    payments: Array<{
      memberId: { toString: () => string };
      memberNickname: string;
      amount: number;
      status: string;
    }>;
    isFullyPaid: boolean;
  };
  const list = (periods as PeriodDoc[]).map((p) => ({
    _id: p._id.toString(),
    periodLabel: p.periodLabel,
    totalPrice: p.totalPrice,
    payments: p.payments.map((pay) => ({
      memberId: pay.memberId.toString(),
      memberNickname: pay.memberNickname,
      amount: pay.amount,
      status: pay.status,
    })),
    isFullyPaid: p.isFullyPaid,
  }));

  return NextResponse.json({
    data: {
      periods: list,
      pagination: { page, totalPages, total },
    },
  });
}

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
  if (!mongoose.isValidObjectId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }

  const parsed = createPeriodSchema.safeParse(await request.json());
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
      { error: { code: "FORBIDDEN", message: "Only the admin can create billing periods" } },
      { status: 403 }
    );
  }

  const periodStart = parseDate(parsed.data.periodStart);
  const periodEnd = parseDate(parsed.data.periodEnd);
  const totalPrice = parsed.data.totalPrice;
  const periodLabel = parsed.data.periodLabel;

  const existing = await BillingPeriod.findOne({
    group: groupId,
    periodStart,
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "A billing period already exists for this start date" } },
      { status: 409 }
    );
  }

  const shares = calculateShares(group, totalPrice);
  if (shares.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Group has no active members to split payment" } },
      { status: 400 }
    );
  }

  const payments = shares.map((share) => ({
    memberId: share.memberId,
    memberEmail: share.email,
    memberNickname: share.nickname,
    amount: share.amount,
    status: "pending" as const,
    confirmationToken: createConfirmationToken(
      share.memberId,
      "", // periodId filled after create
      groupId
    ),
  }));

  const period = await BillingPeriod.create({
    group: groupId,
    periodStart,
    periodEnd,
    periodLabel,
    totalPrice,
    currency: group.billing.currency,
    payments,
  });

  for (const payment of period.payments) {
    payment.confirmationToken = createConfirmationToken(
      payment.memberId.toString(),
      period._id.toString(),
      groupId
    );
  }
  await period.save();

  return NextResponse.json({
    data: {
      _id: period._id.toString(),
      periodLabel: period.periodLabel,
      periodStart: period.periodStart.toISOString().slice(0, 10),
      periodEnd: period.periodEnd.toISOString().slice(0, 10),
      totalPrice: period.totalPrice,
      currency: period.currency,
      payments: period.payments.map((p: IMemberPayment) => ({
        memberId: p.memberId.toString(),
        memberNickname: p.memberNickname,
        amount: p.amount,
        status: p.status,
      })),
    },
  });
}
