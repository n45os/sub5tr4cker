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

function shouldRecalculateExistingPayments(group: IGroup): boolean {
  return group.billing.mode === "equal_split" || group.billing.mode === "variable";
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
    if (payment.adjustedAmount != null) continue;

    const nextAmount = shareByMemberId.get(payment.memberId.toString());
    if (nextAmount == null) continue;

    payment.amount = nextAmount;
  }
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
