import { BillingPeriod } from "@/models";
import type { IGroup, IGroupMember, IMemberPayment } from "@/models";
import { createConfirmationToken } from "@/lib/tokens";
import { calculateShares } from "./calculator";

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
// is not already present.
export async function backfillMemberIntoPeriods(
  group: IGroup,
  member: IGroupMember,
): Promise<number> {
  const billingStart = member.billingStartsAt ?? member.joinedAt;
  if (!billingStart) return 0;

  const periods = await BillingPeriod.find({
    group: group._id,
    periodStart: { $gte: billingStart },
  });

  let backfilledCount = 0;

  for (const period of periods) {
    const alreadyIncluded = period.payments.some(
      (p: IMemberPayment) => p.memberId.toString() === member._id.toString(),
    );
    if (alreadyIncluded) continue;

    // calculate what this member should owe for this period
    const shares = calculateShares(group, period.totalPrice, period.periodStart);
    const memberShare = shares.find(
      (s) => s.memberId === member._id.toString(),
    );

    // if calculator doesn't include this member (e.g. billing hasn't started), use a
    // fallback based on the existing per-member average
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

    period.isFullyPaid = false;
    await period.save();
    backfilledCount++;
  }

  return backfilledCount;
}
