import { BillingPeriod } from "@/models";
import type { IGroup, IGroupMember, IMemberPayment } from "@/models";
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

function shouldRecalculateExistingPayments(group: IGroup): boolean {
  return group.billing.mode === "equal_split" || group.billing.mode === "variable";
}

// automatic price-change rows from PATCH /groups/[id]; safe to replace on roster/split recalc
function isPriceSyncAdjustment(payment: IMemberPayment): boolean {
  const r = payment.adjustmentReason;
  if (r == null || r === "") return false;
  return r.startsWith("price updated from");
}

function hasManualAmountOverride(payment: IMemberPayment): boolean {
  return payment.adjustedAmount != null && !isPriceSyncAdjustment(payment);
}

function recalculatePeriodPayments(
  period: { payments: IMemberPayment[] },
  group: IGroup,
  totalPrice: number,
  periodStart: Date,
) {
  const shares = calculateShares(group, totalPrice, periodStart);
  const shareByMemberId = new Map(
    shares.map((share) => [share.memberId, share.amount]),
  );

  for (const payment of period.payments) {
    if (hasManualAmountOverride(payment)) continue;

    const nextAmount = shareByMemberId.get(payment.memberId.toString());
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
  group: IGroup,
): Promise<{ periodsUpdated: number }> {
  if (!shouldRecalculateExistingPayments(group)) {
    return { periodsUpdated: 0 };
  }

  const periods = await BillingPeriod.find({ group: group._id }).sort({
    periodStart: 1,
  });

  let periodsUpdated = 0;
  for (const period of periods) {
    recalculatePeriodPayments(period, group, period.totalPrice, period.periodStart);
    period.isFullyPaid = period.payments.every(
      (p: IMemberPayment) => p.status === "confirmed" || p.status === "waived",
    );
    await period.save();
    periodsUpdated++;
  }

  return { periodsUpdated };
}

// backfill a member into existing billing periods that started on or after
// their billingStartsAt date. only adds payment entries where the member
// is not already present. returns backfilled count and credit summary for
// existing members who overpaid (confirmed status) on affected periods.
export async function backfillMemberIntoPeriods(
  group: IGroup,
  member: IGroupMember,
): Promise<BackfillResult> {
  const billingStart = member.billingStartsAt ?? member.joinedAt;
  if (!billingStart) return { backfilledCount: 0, creditSummary: [] };

  const periods = await BillingPeriod.find({
    group: group._id,
    periodStart: { $gte: billingStart },
  }).sort({ periodStart: 1 });

  let backfilledCount = 0;
  const creditByMemberId = new Map<
    string,
    { memberNickname: string; memberEmail: string; periods: MemberCreditPeriod[] }
  >();

  for (const period of periods) {
    const alreadyIncluded = period.payments.some(
      (p: IMemberPayment) => p.memberId.toString() === member._id.toString(),
    );
    if (alreadyIncluded) continue;

    // capture old effective amounts for confirmed payments before we recalculate
    const oldAmounts = new Map<string, number>();
    for (const p of period.payments) {
      const typed = p as IMemberPayment;
      if (typed.status !== "confirmed" && typed.status !== "waived") continue;
      const effective = typed.adjustedAmount ?? typed.amount;
      oldAmounts.set(typed.memberId.toString(), effective);
    }

    // calculate what this member should owe for this period
    const shares = calculateShares(group, period.totalPrice, period.periodStart);
    const memberShare = shares.find(
      (s) => s.memberId === member._id.toString(),
    );

    const amount = memberShare?.amount ?? (
      period.payments.length > 0
        ? period.payments.reduce(
            (s: number, p: IMemberPayment) => s + p.amount,
            0,
          ) / period.payments.length
        : 0
    );

    if (amount <= 0) continue;

    const token = await createConfirmationToken(
      member._id.toString(),
      period._id.toString(),
      group._id.toString(),
    );

    period.payments.push({
      memberId: member._id,
      memberEmail: member.email,
      memberNickname: member.nickname,
      amount,
      status: "pending",
      confirmationToken: token,
    } as never);

    if (shouldRecalculateExistingPayments(group)) {
      recalculatePeriodPayments(period, group, period.totalPrice, period.periodStart);
    }

    // build credit entries for members who overpaid (confirmed/waived)
    for (const [mid, oldAmount] of oldAmounts) {
      const payment = period.payments.find(
        (p: IMemberPayment) => p.memberId.toString() === mid,
      ) as IMemberPayment | undefined;
      if (!payment) continue;
      const newAmount = payment.adjustedAmount ?? payment.amount;
      const credit = Math.round((oldAmount - newAmount) * 100) / 100;
      if (credit <= 0) continue;

      const existing = creditByMemberId.get(mid);
      const entry: MemberCreditPeriod = {
        periodId: period._id.toString(),
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
    await period.save();
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
  group: IGroup,
  removedMember: IGroupMember,
): Promise<RemovalRecalcResult> {
  const memberId = removedMember._id.toString();

  const periods = await BillingPeriod.find({
    group: group._id,
    "payments.memberId": removedMember._id,
  }).sort({ periodStart: 1 });

  let recalculatedCount = 0;
  let latestNewShare = 0;
  const removedMemberPendingPeriods: RemovalRecalcResult["removedMemberPendingPeriods"] = [];

  for (const period of periods) {
    const removedPayment = period.payments.find(
      (p: IMemberPayment) => p.memberId.toString() === memberId,
    ) as IMemberPayment | undefined;

    // collect the removed member's pending/overdue payments for the admin summary
    if (
      removedPayment &&
      (removedPayment.status === "pending" || removedPayment.status === "overdue")
    ) {
      removedMemberPendingPeriods.push({
        periodId: period._id.toString(),
        periodLabel: period.periodLabel,
        amount: removedPayment.adjustedAmount ?? removedPayment.amount,
        status: removedPayment.status,
      });
    }

    // only recalculate periods that have at least one pending/overdue remaining member
    const hasPendingRemaining = period.payments.some(
      (p: IMemberPayment) =>
        p.memberId.toString() !== memberId &&
        (p.status === "pending" || p.status === "overdue"),
    );
    if (!hasPendingRemaining) continue;

    if (!shouldRecalculateExistingPayments(group)) continue;

    recalculatePeriodPayments(period, group, period.totalPrice, period.periodStart);

    // track the latest new share amount for the response
    const anyRemainingPayment = period.payments.find(
      (p: IMemberPayment) =>
        p.memberId.toString() !== memberId && p.adjustedAmount == null,
    ) as IMemberPayment | undefined;
    if (anyRemainingPayment) {
      latestNewShare = anyRemainingPayment.amount;
    }

    await period.save();
    recalculatedCount++;
  }

  return {
    recalculatedCount,
    newShareAmount: latestNewShare,
    removedMemberPendingPeriods,
  };
}
