import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group, ScheduledTask } from "@/models";
import type { ScheduledTaskType, ScheduledTaskStatus } from "@/models/scheduled-task";
import {
  buildScheduledTaskVisibilityFilter,
  getGroupIdsWhereUserIsAdmin,
} from "@/lib/tasks/admin-access";

const TYPES: ScheduledTaskType[] = [
  "payment_reminder",
  "aggregated_payment_reminder",
  "admin_confirmation_request",
  "price_change",
  "invite",
  "follow_up",
];

const STATUSES: ScheduledTaskStatus[] = [
  "pending",
  "locked",
  "completed",
  "failed",
  "cancelled",
];

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  status: z.enum(STATUSES as [ScheduledTaskStatus, ...ScheduledTaskStatus[]]).optional(),
  type: z.enum(TYPES as [ScheduledTaskType, ...ScheduledTaskType[]]).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { page, limit, status: statusFilter, type: typeFilter } = parsed.data;
  const adminGroupIds = await getGroupIdsWhereUserIsAdmin(session.user.id);

  if (adminGroupIds.length === 0) {
    return NextResponse.json({
      data: {
        items: [],
        pagination: { page, totalPages: 0, total: 0 },
      },
    });
  }

  await dbConnect();

  const visibility = buildScheduledTaskVisibilityFilter(adminGroupIds);
  const filter: Record<string, unknown> = {
    ...visibility,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  };

  const skip = (page - 1) * limit;
  const [total, tasks] = await Promise.all([
    ScheduledTask.countDocuments(filter),
    ScheduledTask.find(filter)
      .sort({ runAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);

  const groupIds = new Set<string>();
  const periodIds = new Set<string>();
  for (const t of tasks) {
    const p = t.payload as {
      groupId?: string;
      billingPeriodId?: string;
      payments?: Array<{ groupId?: string; billingPeriodId?: string }>;
    };
    if (p.groupId) groupIds.add(p.groupId);
    if (p.billingPeriodId) periodIds.add(p.billingPeriodId);
    if (p.payments?.length) {
      for (const ref of p.payments) {
        if (ref.groupId) groupIds.add(ref.groupId);
        if (ref.billingPeriodId) periodIds.add(ref.billingPeriodId);
      }
    }
  }

  const validGroupOids = [...groupIds].filter((id) =>
    mongoose.isValidObjectId(id)
  );
  const validPeriodOids = [...periodIds].filter((id) =>
    mongoose.isValidObjectId(id)
  );

  const [groups, periods] = await Promise.all([
    validGroupOids.length
      ? Group.find({
          _id: {
            $in: validGroupOids.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("name")
          .lean()
      : [],
    validPeriodOids.length
      ? BillingPeriod.find({
          _id: {
            $in: validPeriodOids.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("periodLabel")
          .lean()
      : [],
  ]);

  const groupNameById = new Map(
    groups.map((g) => [g._id.toString(), g.name as string])
  );
  const periodLabelById = new Map(
    periods.map((p) => [p._id.toString(), p.periodLabel as string])
  );

  const items = tasks.map((t) => {
    const payload = t.payload as {
      groupId?: string;
      billingPeriodId?: string;
      memberEmail?: string;
      paymentId?: string;
      payments?: Array<{
        groupId: string;
        billingPeriodId: string;
        paymentId: string;
      }>;
    };
    let summary = "";
    if (t.type === "aggregated_payment_reminder" && payload.memberEmail) {
      const n = payload.payments?.length ?? 0;
      summary = `${payload.memberEmail} — ${n} payment(s)`;
    } else if (payload.groupId) {
      const gName = groupNameById.get(payload.groupId) ?? "Group";
      const pLabel = payload.billingPeriodId
        ? (periodLabelById.get(payload.billingPeriodId) ?? "")
        : "";
      summary = pLabel ? `${gName} — ${pLabel}` : gName;
    } else {
      summary = String(t.type).replace(/_/g, " ");
    }

    return {
      _id: t._id.toString(),
      type: t.type,
      status: t.status,
      runAt: t.runAt.toISOString(),
      attempts: t.attempts ?? 0,
      maxAttempts: t.maxAttempts ?? 5,
      lastError: t.lastError ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      cancelledAt: (t as { cancelledAt?: Date | null }).cancelledAt?.toISOString() ?? null,
      idempotencyKey: t.idempotencyKey,
      summary,
      payload: t.payload,
    };
  });

  const totalPages = Math.ceil(total / limit) || 0;

  return NextResponse.json({
    data: {
      items,
      pagination: { page, totalPages, total },
    },
  });
}
