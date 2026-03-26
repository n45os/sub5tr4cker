import { nanoid } from "nanoid";
import { db, type StorageGroup, type StorageGroupMember, type StorageMemberPayment } from "@/lib/storage";
import { createConfirmationToken } from "@/lib/tokens";
import { calculateShares } from "./calculator";

export interface MemberCreditPeriod {
  periodId: string;
  periodLabel: string;
  oldAmount: number;
  newAmount: number;
  credit: number;
}

export interface MemberCredit {
  memberId: string;
  memberNickname: string;
  memberEmail: string;
  totalCredit: number;
  periods: MemberCreditPeriod[];
}

export interface BackfillResult {
  backfilledCount: number;
  creditSummary: MemberCredit[];
}

export interface RemovalRecalcResult {
  recalculatedCount: number;
  newShareAmount: number;
  removedMemberPendingPeriods: Array<{
    periodId: string;
    periodLabel: string;
    amount: number;
    status: string;
  }>;
}

function shouldRecalculateExistingPayments(group: StorageGroup): boolean {
  return group.billing.mode === "equal_split" || group.billing.mode === "variable";
}

// automatic price-change rows from PATCH /groups/[id]; safe to replace on roster/split recalc
function isPriceSyncAdjustment(payment: StorageMemberPayment): boolean {
  const r = payment.adjustmentReason;
  if (r == null || r === "") return false;
  return r.startsWith("price updated from");
}

function hasManualAmountOverride(payment: StorageMemberPayment): boolean {
  return payment.adjustedAmount != null && !isPriceSyncAdjustment(payment);
}

function recalculatePeriodPayments(
  period: { payments: StorageMemberPayment[] },
  group: StorageGroup,
  totalPrice: number,
  periodStart: Date,
) {
  const shares = calculateShares(group, totalPrice, periodStart);
  const shareByMemberId = new Map(
    shares.map((share) => [share.memberId, share.amount]),
  );
  const owedMemberIds = new Set(shares.map((s) => s.memberId));

  // drop rows for active members who are not in this period's split (e.g. billing
  // starts mid-year but a bogus row exists from an old fallback). keep former members
  // and manual admin overrides.
  period.payments = period.payments.filter((p: StorageMemberPayment) => {
    if (hasManualAmountOverride(p)) return true;
    const mid = p.memberId;
    if (owedMemberIds.has(mid)) return true;
    const m = group.members.find((x) => x.id === mid);
    if (!m) return false;
    if (!m.isActive || m.leftAt) return true;
    return false;
  });

  for (const payment of period.payments) {
    if (hasManualAmountOverride(payment)) continue;

    const nextAmount = shareByMemberId.get(payment.memberId);
    if (nextAmount == null) continue;

    payment.amount = nextAmount;

    if (payment.adjustedAmount != null && isPriceSyncAdjustment(payment)) {
      payment.adjustedAmount = null;
      payment.adjustmentReason = null;
    }
  }
}

// re-run equal/variable shares for every period (e.g. admin included-in-split toggled)
export async function recalculateEqualSplitPeriodsForGroup(
  group: StorageGroup,
): Promise<{ periodsUpdated: number }> {
  if (!shouldRecalculateExistingPayments(group)) {
    return { periodsUpdated: 0 };
  }

  const store = await db();
  const periods = (await store.getPeriodsForGroup(group.id)).sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime()
  );

  let periodsUpdated = 0;
  for (const period of periods) {
    recalculatePeriodPayments(period, group, period.totalPrice, period.periodStart);
    period.isFullyPaid = period.payments.every(
      (p: StorageMemberPayment) => p.status === "confirmed" || p.status === "waived",
    );
    await store.updateBillingPeriod(period.id, {
      payments: period.payments,
      isFullyPaid: period.isFullyPaid,
    });
    periodsUpdated++;
  }

  return { periodsUpdated };
}

// recompute shares for one period from current group rules (equal_split / variable)
export function recalculateSinglePeriodFromGroupRules(
  group: StorageGroup,
  period: {
    payments: StorageMemberPayment[];
    totalPrice: number;
    periodStart: Date;
  },
): boolean {
  if (!shouldRecalculateExistingPayments(group)) {
    return false;
  }
  recalculatePeriodPayments(
    period,
    group,
    period.totalPrice,
    period.periodStart,
  );
  return true;
}

// backfill a member into existing billing periods that started on or after
// their billingStartsAt date. only adds payment entries where the member
// is not already present. returns backfilled count and credit summary for
// existing members who overpaid (confirmed status) on affected periods.
export async function backfillMemberIntoPeriods(
  group: StorageGroup,
  member: StorageGroupMember,
): Promise<BackfillResult> {
  const billingStart = member.billingStartsAt ?? member.joinedAt;
  if (!billingStart) return { backfilledCount: 0, creditSummary: [] };

  const store = await db();
  const periods = (await store.getPeriodsForGroup(group.id))
    .filter((period) => period.periodStart >= billingStart)
    .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

  let backfilledCount = 0;
  const creditByMemberId = new Map<
    string,
    { memberNickname: string; memberEmail: string; periods: MemberCreditPeriod[] }
  >();

  for (const period of periods) {
    const alreadyIncluded = period.payments.some(
      (p: StorageMemberPayment) => p.memberId === member.id,
    );
    if (alreadyIncluded) continue;

    // capture old effective amounts for confirmed payments before we recalculate
    const oldAmounts = new Map<string, number>();
    for (const p of period.payments) {
      const typed = p as StorageMemberPayment;
      if (typed.status !== "confirmed" && typed.status !== "waived") continue;
      const effective = typed.adjustedAmount ?? typed.amount;
      oldAmounts.set(typed.memberId, effective);
    }

    // calculate what this member should owe for this period
    const shares = calculateShares(group, period.totalPrice, period.periodStart);
    const memberShare = shares.find(
      (s) => s.memberId === member.id,
    );

    // member is not valid for this period's split (billing start after period start)
    if (!memberShare) continue;

    const amount = memberShare.amount;

    if (amount <= 0) continue;

    const token = await createConfirmationToken(
      member.id,
      period.id,
      group.id,
    );

    period.payments.push({
      id: nanoid(),
      memberId: member.id,
      memberEmail: member.email,
      memberNickname: member.nickname,
      amount,
      adjustedAmount: null,
      adjustmentReason: null,
      status: "pending",
      memberConfirmedAt: null,
      adminConfirmedAt: null,
      confirmationToken: token,
      notes: null,
    });

    if (shouldRecalculateExistingPayments(group)) {
      recalculatePeriodPayments(period, group, period.totalPrice, period.periodStart);
    }

    // build credit entries for members who overpaid (confirmed/waived)
    for (const [mid, oldAmount] of oldAmounts) {
      const payment = period.payments.find(
        (p: StorageMemberPayment) => p.memberId === mid,
      ) as StorageMemberPayment | undefined;
      if (!payment) continue;
      const newAmount = payment.adjustedAmount ?? payment.amount;
      const credit = Math.round((oldAmount - newAmount) * 100) / 100;
      if (credit <= 0) continue;

      const existing = creditByMemberId.get(mid);
      const entry: MemberCreditPeriod = {
        periodId: period.id,
        periodLabel: period.periodLabel,
        oldAmount,
        newAmount,
        credit,
      };
      if (existing) {
        existing.periods.push(entry);
      } else {
        creditByMemberId.set(mid, {
          memberNickname: payment.memberNickname,
          memberEmail: payment.memberEmail,
          periods: [entry],
        });
      }
    }

    period.isFullyPaid = false;
    await store.updateBillingPeriod(period.id, {
      payments: period.payments,
      isFullyPaid: period.isFullyPaid,
    });
    backfilledCount++;
  }

  const creditSummary: MemberCredit[] = Array.from(creditByMemberId.entries()).map(
    ([memberId, data]) => ({
      memberId,
      memberNickname: data.memberNickname,
      memberEmail: data.memberEmail,
      totalCredit: data.periods.reduce((sum, p) => sum + p.credit, 0),
      periods: data.periods,
    }),
  );

  return { backfilledCount, creditSummary };
}

// recalculate pending/future period amounts after a member is removed.
// the member must already be soft-deleted (isActive: false) on the group
// so calculateShares excludes them. leaves the removed member's own
// payment entries untouched for manual admin handling.
export async function recalculatePeriodsOnMemberRemoval(
  group: StorageGroup,
  removedMember: StorageGroupMember,
): Promise<RemovalRecalcResult> {
  const memberId = removedMember.id;

  const store = await db();
  const periods = (await store.getPeriodsForGroup(group.id))
    .filter((period) => period.payments.some((payment) => payment.memberId === memberId))
    .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

  let recalculatedCount = 0;
  let latestNewShare = 0;
  const removedMemberPendingPeriods: RemovalRecalcResult["removedMemberPendingPeriods"] = [];

  for (const period of periods) {
    const removedPayment = period.payments.find(
      (p: StorageMemberPayment) => p.memberId === memberId,
    ) as StorageMemberPayment | undefined;

    // collect the removed member's pending/overdue payments for the admin summary
    if (
      removedPayment &&
      (removedPayment.status === "pending" || removedPayment.status === "overdue")
    ) {
      removedMemberPendingPeriods.push({
        periodId: period.id,
        periodLabel: period.periodLabel,
        amount: removedPayment.adjustedAmount ?? removedPayment.amount,
        status: removedPayment.status,
      });
    }

    // only recalculate periods that have at least one pending/overdue remaining member
    const hasPendingRemaining = period.payments.some(
      (p: StorageMemberPayment) =>
        p.memberId !== memberId &&
        (p.status === "pending" || p.status === "overdue"),
    );
    if (!hasPendingRemaining) continue;

    if (!shouldRecalculateExistingPayments(group)) continue;

    recalculatePeriodPayments(period, group, period.totalPrice, period.periodStart);

    // track the latest new share amount for the response
    const anyRemainingPayment = period.payments.find(
      (p: StorageMemberPayment) =>
        p.memberId !== memberId && p.adjustedAmount == null,
    ) as StorageMemberPayment | undefined;
    if (anyRemainingPayment) {
      latestNewShare = anyRemainingPayment.amount;
    }

    await store.updateBillingPeriod(period.id, { payments: period.payments });
    recalculatedCount++;
  }

  return {
    recalculatedCount,
    newShareAmount: latestNewShare,
    removedMemberPendingPeriods,
  };
}
