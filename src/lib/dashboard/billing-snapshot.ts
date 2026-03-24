import type { Types } from "mongoose";
import { collectionWindowOpenFilter } from "@/lib/billing/collection-window";

/** payment rows that still need admin or member follow-up (open periods only, see query helper) */
export const OUTSTANDING_PAYMENT_STATUSES = [
  "pending",
  "overdue",
  "member_confirmed",
] as const;

/** statuses eligible for payment reminder sends (matches notify-unpaid) */
export const REMINDER_ELIGIBLE_STATUSES = ["pending", "overdue"] as const;

export type GroupOutstanding = {
  outstandingPaymentCount: number;
  pendingCount: number;
  overdueCount: number;
  memberConfirmedCount: number;
};

/**
 * Mongo query for billing periods that can contribute to outstanding payment counts.
 * Aligns quick-status, group list unpaidCount, and notify-unpaid period selection.
 */
export function buildOpenOutstandingPeriodsQuery(
  groupIds: Types.ObjectId[],
  now: Date
) {
  return {
    group: { $in: groupIds },
    isFullyPaid: false,
    ...collectionWindowOpenFilter(now),
    "payments.status": { $in: [...OUTSTANDING_PAYMENT_STATUSES] },
  };
}

/**
 * aggregate payment rows across periods (same group may appear in multiple periods)
 */
export function aggregateOutstandingByGroupFromPeriods(
  periods: Array<{
    group: { toString: () => string } | string;
    payments?: Array<{ status: string }>;
  }>
): Map<string, GroupOutstanding> {
  const map = new Map<string, GroupOutstanding>();

  const bump = (gid: string): GroupOutstanding => {
    let g = map.get(gid);
    if (!g) {
      g = {
        outstandingPaymentCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        memberConfirmedCount: 0,
      };
      map.set(gid, g);
    }
    return g;
  };

  for (const period of periods) {
    const gid =
      typeof period.group === "string"
        ? period.group
        : period.group.toString();
    for (const p of period.payments ?? []) {
      if (p.status === "pending") {
        const g = bump(gid);
        g.outstandingPaymentCount += 1;
        g.pendingCount += 1;
      } else if (p.status === "overdue") {
        const g = bump(gid);
        g.outstandingPaymentCount += 1;
        g.overdueCount += 1;
      } else if (p.status === "member_confirmed") {
        const g = bump(gid);
        g.outstandingPaymentCount += 1;
        g.memberConfirmedCount += 1;
      }
    }
  }

  return map;
}

export function buildAdminBillingSnapshot(
  adminGroupIds: string[],
  byGroup: Map<string, GroupOutstanding>
): {
  totalGroups: number;
  groupsNeedingAttention: number;
  groupsEligibleForReminders: number;
  pendingCount: number;
  overdueCount: number;
  memberConfirmedCount: number;
} {
  let pendingCount = 0;
  let overdueCount = 0;
  let memberConfirmedCount = 0;
  let groupsNeedingAttention = 0;
  let groupsEligibleForReminders = 0;

  for (const gid of adminGroupIds) {
    const agg = byGroup.get(gid);
    if (!agg || agg.outstandingPaymentCount === 0) continue;
    groupsNeedingAttention += 1;
    pendingCount += agg.pendingCount;
    overdueCount += agg.overdueCount;
    memberConfirmedCount += agg.memberConfirmedCount;
    if (agg.pendingCount + agg.overdueCount > 0) {
      groupsEligibleForReminders += 1;
    }
  }

  return {
    totalGroups: adminGroupIds.length,
    groupsNeedingAttention,
    groupsEligibleForReminders,
    pendingCount,
    overdueCount,
    memberConfirmedCount,
  };
}
