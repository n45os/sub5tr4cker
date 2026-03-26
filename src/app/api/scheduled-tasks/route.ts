import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getGroupIdsWhereUserIsAdmin } from "@/lib/tasks/admin-access";
import { db, type StorageScheduledTask } from "@/lib/storage";

const TYPES: StorageScheduledTask["type"][] = [
  "payment_reminder",
  "aggregated_payment_reminder",
  "admin_confirmation_request",
];

const STATUSES: StorageScheduledTask["status"][] = [
  "pending",
  "locked",
  "completed",
  "failed",
  "cancelled",
];

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  status: z.enum(STATUSES as [StorageScheduledTask["status"], ...StorageScheduledTask["status"][]]).optional(),
  type: z.enum(TYPES as [StorageScheduledTask["type"], ...StorageScheduledTask["type"][]]).optional(),
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

  const store = await db();
  const skip = (page - 1) * limit;
  const { tasks, total } = await store.listTasks({
    anyGroupIdIn: adminGroupIds,
    status: statusFilter,
    type: typeFilter,
    limit,
    offset: skip,
  });

  const groupIds = new Set<string>();
  for (const t of tasks) {
    const p = t.payload;
    if (p.groupId) groupIds.add(p.groupId);
    if (p.payments?.length) {
      for (const ref of p.payments) {
        if (ref.groupId) groupIds.add(ref.groupId);
      }
    }
  }

  const groupNameById = new Map<string, string>();
  const periodLabelById = new Map<string, string>();

  for (const gid of groupIds) {
    const g = await store.getGroup(gid);
    if (g) groupNameById.set(gid, g.name);
  }

  const periodPairs = new Set<string>();
  for (const t of tasks) {
    const p = t.payload;
    if (p.groupId && p.billingPeriodId) {
      periodPairs.add(`${p.billingPeriodId}\t${p.groupId}`);
    }
    if (p.payments?.length) {
      for (const ref of p.payments) {
        if (ref.groupId && ref.billingPeriodId) {
          periodPairs.add(`${ref.billingPeriodId}\t${ref.groupId}`);
        }
      }
    }
  }
  for (const pair of periodPairs) {
    const [periodId, groupId] = pair.split("\t");
    if (!periodId || !groupId) continue;
    const per = await store.getBillingPeriod(periodId, groupId);
    if (per) periodLabelById.set(periodId, per.periodLabel);
  }

  const items = tasks.map((t) => {
    const payload = t.payload;
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
      _id: t.id,
      type: t.type,
      status: t.status,
      runAt: t.runAt.toISOString(),
      attempts: t.attempts ?? 0,
      maxAttempts: t.maxAttempts ?? 5,
      lastError: t.lastError ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      cancelledAt: t.cancelledAt?.toISOString() ?? null,
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
