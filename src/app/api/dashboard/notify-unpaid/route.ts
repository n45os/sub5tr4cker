import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group } from "@/models";
import { getReminderEligibility } from "@/lib/notifications/reminder-targeting";
import { sendReminderForPayment } from "@/lib/notifications/reminder-send";
import type { SkipReason } from "@/lib/notifications/reminder-targeting";
import type { IMemberPayment } from "@/models/billing-period";

// admin-only: list unpaid reminder candidates (no grace period) and build preview or send
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  await dbConnect();

  const adminId = session.user.id;
  const now = new Date();

  const groups = await Group.find({
    admin: adminId,
    isActive: true,
    $or: [
      { "notifications.remindersEnabled": { $ne: false } },
      { notifications: { $exists: false } },
    ],
  })
    .lean()
    .exec();

  const groupIds = groups.map((g) => g._id);
  const periods = await BillingPeriod.find({
    group: { $in: groupIds },
    isFullyPaid: false,
    periodStart: { $lt: now },
    "payments.status": { $in: ["pending", "overdue"] },
  })
    .populate("group")
    .lean()
    .exec();

  const byGroup: Array<{
    groupId: string;
    groupName: string;
    periods: Array<{
      periodId: string;
      periodLabel: string;
      payments: Array<{
        paymentId: string;
        memberEmail: string;
        memberNickname: string;
        amount: number;
        currency: string;
        status: string;
        sendEmail: boolean;
        sendTelegram: boolean;
        skipReasons: SkipReason[];
      }>;
    }>;
  }> = [];

  const skipReasonCounts: Record<SkipReason, number> = {
    unsubscribed_from_email: 0,
    email_pref_off: 0,
    telegram_pref_off: 0,
    no_telegram_link: 0,
    no_reachable_channel: 0,
  };

  let totalPayments = 0;
  let totalSendEmail = 0;
  let totalSendTelegram = 0;

  for (const period of periods) {
    const group = period.group as { _id: unknown; name: string; members: unknown[] };
    if (!group || Array.isArray(group)) continue;
    const groupIdStr = (group._id as { toString: () => string }).toString();
    const unpaidPayments = (period.payments as Array<{ status: string; memberId: unknown; memberEmail: string; memberNickname: string; amount: number; confirmationToken: string | null; _id: unknown }>).filter(
      (p) => p.status === "pending" || p.status === "overdue"
    );

    if (unpaidPayments.length === 0) continue;

    let groupEntry = byGroup.find((e) => e.groupId === groupIdStr);
    if (!groupEntry) {
      groupEntry = { groupId: groupIdStr, groupName: group.name, periods: [] };
      byGroup.push(groupEntry);
    }

    const periodEligibilities: Array<{
      paymentId: string;
      memberEmail: string;
      memberNickname: string;
      amount: number;
      currency: string;
      status: string;
      sendEmail: boolean;
      sendTelegram: boolean;
      skipReasons: SkipReason[];
    }> = [];

    for (const payment of unpaidPayments) {
      const eligibility = await getReminderEligibility({
        group: group as Parameters<typeof getReminderEligibility>[0]["group"],
        period: period as Parameters<typeof getReminderEligibility>[0]["period"],
        payment: payment as Parameters<typeof getReminderEligibility>[0]["payment"],
      });
      totalPayments += 1;
      if (eligibility.sendEmail) totalSendEmail += 1;
      if (eligibility.sendTelegram) totalSendTelegram += 1;
      for (const r of eligibility.skipReasons) skipReasonCounts[r] += 1;
      periodEligibilities.push({
        paymentId: eligibility.paymentId,
        memberEmail: eligibility.memberEmail,
        memberNickname: eligibility.memberNickname,
        amount: eligibility.amount,
        currency: eligibility.currency,
        status: eligibility.status,
        sendEmail: eligibility.sendEmail,
        sendTelegram: eligibility.sendTelegram,
        skipReasons: eligibility.skipReasons,
      });
    }

    groupEntry.periods.push({
      periodId: (period._id as { toString: () => string }).toString(),
      periodLabel: period.periodLabel,
      payments: periodEligibilities,
    });
  }

  return NextResponse.json({
    data: {
      byGroup,
      summary: {
        totalPayments,
        totalSendEmail,
        totalSendTelegram,
        skipReasonCounts,
      },
    },
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  await dbConnect();

  const adminId = session.user.id;
  const now = new Date();

  const groups = await Group.find({
    admin: adminId,
    isActive: true,
    $or: [
      { "notifications.remindersEnabled": { $ne: false } },
      { notifications: { $exists: false } },
    ],
  }).exec();

  const groupIds = groups.map((g) => g._id);
  const periods = await BillingPeriod.find({
    group: { $in: groupIds },
    isFullyPaid: false,
    periodStart: { $lt: now },
    "payments.status": { $in: ["pending", "overdue"] },
  })
    .populate("group")
    .exec();

  let emailSent = 0;
  let telegramSent = 0;
  let skipped = 0;
  let failed = 0;

  const periodIdsUpdated = new Set<string>();

  for (const period of periods) {
    const group = period.group as InstanceType<typeof Group>;
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;

    let periodRecipientCount = 0;

    for (const payment of period.payments) {
      const p = payment as IMemberPayment;
      if (p.status !== "pending" && p.status !== "overdue") continue;

      try {
        const eligibility = await getReminderEligibility({ group, period, payment: p });
        if (!eligibility.sendEmail && !eligibility.sendTelegram) {
          skipped += 1;
          continue;
        }

        const result = await sendReminderForPayment(group, period, p);
        if (result.emailSent) emailSent += 1;
        if (result.telegramSent) telegramSent += 1;
        if (result.emailSent || result.telegramSent) periodRecipientCount += 1;
      } catch {
        failed += 1;
      }
    }

    if (periodRecipientCount > 0) {
      const periodIdStr = (period._id as { toString: () => string }).toString();
      if (!periodIdsUpdated.has(periodIdStr)) {
        periodIdsUpdated.add(periodIdStr);
        period.reminders.push({
          sentAt: new Date(),
          channel: "email",
          recipientCount: periodRecipientCount,
          type: period.reminders.length === 0 ? "initial" : "follow_up",
        });
        await period.save();
      }
    }
  }

  return NextResponse.json({
    data: {
      emailSent,
      telegramSent,
      skipped,
      failed,
    },
  });
}
