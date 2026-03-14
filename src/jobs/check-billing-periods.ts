import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import { calculateShares, formatPeriodLabel, getPeriodDates } from "@/lib/billing/calculator";
import { createConfirmationToken } from "@/lib/tokens";

// create billing period entries for groups that are due
export async function checkBillingPeriods(): Promise<void> {
  await dbConnect();

  const now = new Date();
  const activeGroups = await Group.find({ isActive: true });

  for (const group of activeGroups) {
    try {
      await createPeriodIfDue(group, now);
    } catch (error) {
      console.error(`error creating period for group ${group._id}:`, error);
    }
  }
}

async function createPeriodIfDue(
  group: InstanceType<typeof Group>,
  now: Date
): Promise<void> {
  const { cycleDay } = group.billing;

  // check if a period already exists for the current month
  const { start, end } = getPeriodDates(
    now.getFullYear(),
    now.getMonth(),
    cycleDay
  );

  // only create if we're past the cycle day
  if (now < start) return;

  const existing = await BillingPeriod.findOne({
    group: group._id,
    periodStart: start,
  });

  if (existing) return;

  const shares = calculateShares(group);
  if (shares.length === 0) return;

  const periodLabel = formatPeriodLabel(start);

  const payments = await Promise.all(
    shares.map(async (share) => {
      const token = await createConfirmationToken(
      share.memberId,
      "pending", // will be updated after creation with actual period ID
      group._id.toString()
      );
      return {
        memberId: share.memberId,
        memberEmail: share.email,
        memberNickname: share.nickname,
        amount: share.amount,
        status: "pending" as const,
        confirmationToken: token,
      };
    })
  );

  const period = await BillingPeriod.create({
    group: group._id,
    periodStart: start,
    periodEnd: end,
    periodLabel,
    totalPrice: group.billing.currentPrice,
    currency: group.billing.currency,
    payments,
  });

  // update confirmation tokens with the actual period ID
  for (const payment of period.payments) {
    payment.confirmationToken = await createConfirmationToken(
      payment.memberId.toString(),
      period._id.toString(),
      group._id.toString()
    );
  }
  await period.save();

  console.log(`created billing period ${periodLabel} for group ${group.name}`);
}
