import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";

const importPeriodSchema = z.object({
  periodLabel: z.string().min(1).max(50),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  totalPrice: z.number().positive(),
  payments: z.array(
    z.object({
      memberEmail: z.string().email(),
      amount: z.number().min(0),
      status: z.enum(["confirmed", "pending", "waived"]),
    }),
  ),
});

const importSchema = z.object({
  periods: z.array(importPeriodSchema).min(1).max(60),
});

function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00.000Z");
  return new Date(s);
}

export async function POST(
  request: NextRequest,
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

  const parsed = importSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
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
      { error: { code: "FORBIDDEN", message: "Only the admin can import billing history" } },
      { status: 403 },
    );
  }

  const results: Array<{
    periodLabel: string;
    status: "created" | "skipped";
    reason?: string;
  }> = [];

  for (const periodData of parsed.data.periods) {
    const periodStart = parseDate(periodData.periodStart);

    // skip if a period with this start date already exists
    const existing = await BillingPeriod.findOne({
      group: groupId,
      periodStart,
    });
    if (existing) {
      results.push({
        periodLabel: periodData.periodLabel,
        status: "skipped",
        reason: "period already exists for this start date",
      });
      continue;
    }

    // match payments to group members by email
    type MemberDoc = { _id: mongoose.Types.ObjectId; email: string; nickname: string };
    const payments = periodData.payments
      .map((p) => {
        const member = group.members.find(
          (m: MemberDoc) => m.email.toLowerCase() === p.memberEmail.toLowerCase(),
        );
        if (!member) return null;
        return {
          memberId: member._id,
          memberEmail: member.email,
          memberNickname: member.nickname,
          amount: p.amount,
          status: p.status,
          adminConfirmedAt: p.status === "confirmed" ? new Date() : null,
        };
      })
      .filter(Boolean);

    const isFullyPaid = payments.every(
      (p) => p && (p.status === "confirmed" || p.status === "waived"),
    );

    await BillingPeriod.create({
      group: groupId,
      periodStart,
      periodEnd: parseDate(periodData.periodEnd),
      periodLabel: periodData.periodLabel,
      totalPrice: periodData.totalPrice,
      currency: group.billing.currency,
      payments,
      isFullyPaid,
    });

    results.push({ periodLabel: periodData.periodLabel, status: "created" });
  }

  return NextResponse.json({
    data: {
      imported: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      details: results,
    },
  });
}
