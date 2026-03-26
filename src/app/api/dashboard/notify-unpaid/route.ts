import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type { ChannelOverride } from "@/lib/notifications/reminder-send";
import {
  sendAggregatedReminder,
  type AggregatedPaymentInput,
} from "@/lib/notifications/aggregated-reminder-send";
import { normalizeMemberEmailForAggregation } from "@/lib/notifications/member-email";
import { getReminderEligibility } from "@/lib/notifications/reminder-targeting";
import type { SkipReason } from "@/lib/notifications/reminder-targeting";
import { db, type StorageBillingPeriod, type StorageMemberPayment } from "@/lib/storage";

const postNotifyUnpaidSchema = z.object({
  groupIds: z.array(z.string()).optional(),
  paymentIds: z.array(z.string()).optional(),
  channelPreference: z.enum(["email", "telegram", "both"]).optional(),
});

// admin-only: list unpaid reminder candidates (no grace; collection window must be open) and build preview or send
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const store = await db();
  const adminId = session.user.id;
  const userEmail = (session.user.email as string) || "";
  const now = new Date();
  const aggregateReminders = true;

  const allForUser = await store.listGroupsForUser(adminId, userEmail);
  const groups = allForUser.filter(
    (g) =>
      g.adminId === adminId &&
      g.isActive &&
      g.notifications.remindersEnabled !== false
  );

  const groupIds = groups.map((g) => g.id);

  const periodsRaw =
    groupIds.length === 0
      ? []
      : await store.getOpenBillingPeriods({
          asOf: now,
          unpaidOnly: true,
          groupIds,
        });

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

  for (const period of periodsRaw) {
    const group = await store.getGroup(period.groupId);
    if (!group || group.adminId !== adminId) continue;

    const groupIdStr = group.id;
    const unpaidPayments = period.payments.filter(
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
        group,
        period,
        payment,
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
      periodId: period.id,
      periodLabel: period.periodLabel,
      payments: periodEligibilities,
    });
  }

  type PaymentEligibility = {
    paymentId: string;
    memberEmail: string;
    memberNickname: string;
    amount: number;
    currency: string;
    status: string;
    sendEmail: boolean;
    sendTelegram: boolean;
    skipReasons: SkipReason[];
    groupId: string;
    groupName: string;
    periodId: string;
    periodLabel: string;
  };

  const byUser: Array<{
    memberEmail: string;
    memberNickname: string;
    totalAmount: number;
    sendEmail: boolean;
    sendTelegram: boolean;
    skipReasons: SkipReason[];
    payments: Array<{
      paymentId: string;
      groupId: string;
      groupName: string;
      periodId: string;
      periodLabel: string;
      amount: number;
      currency: string;
      status: string;
    }>;
  }> = [];

  const byEmail = new Map<
    string,
    {
      representativeEmail: string;
      memberNickname: string;
      sendEmail: boolean;
      sendTelegram: boolean;
      skipReasons: Set<SkipReason>;
      payments: PaymentEligibility[];
    }
  >();
  for (const ge of byGroup) {
    for (const pe of ge.periods) {
      for (const pay of pe.payments) {
        const key = normalizeMemberEmailForAggregation(pay.memberEmail);
        const el: PaymentEligibility = {
          paymentId: pay.paymentId,
          memberEmail: pay.memberEmail,
          memberNickname: pay.memberNickname,
          amount: pay.amount,
          currency: pay.currency,
          status: pay.status,
          sendEmail: pay.sendEmail,
          sendTelegram: pay.sendTelegram,
          skipReasons: pay.skipReasons,
          groupId: ge.groupId,
          groupName: ge.groupName,
          periodId: pe.periodId,
          periodLabel: pe.periodLabel,
        };
        let entry = byEmail.get(key);
        if (!entry) {
          entry = {
            representativeEmail: pay.memberEmail,
            memberNickname: pay.memberNickname,
            sendEmail: false,
            sendTelegram: false,
            skipReasons: new Set(),
            payments: [],
          };
          byEmail.set(key, entry);
        }
        entry.payments.push(el);
        if (pay.sendEmail) entry.sendEmail = true;
        if (pay.sendTelegram) entry.sendTelegram = true;
        for (const r of pay.skipReasons) entry.skipReasons.add(r);
      }
    }
  }
  for (const [, entry] of byEmail) {
    const totalAmount = entry.payments.reduce((s, p) => s + p.amount, 0);
    byUser.push({
      memberEmail: entry.representativeEmail,
      memberNickname: entry.memberNickname,
      totalAmount,
      sendEmail: entry.sendEmail,
      sendTelegram: entry.sendTelegram,
      skipReasons: Array.from(entry.skipReasons),
      payments: entry.payments.map((p) => ({
        paymentId: p.paymentId,
        groupId: p.groupId,
        groupName: p.groupName,
        periodId: p.periodId,
        periodLabel: p.periodLabel,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
      })),
    });
  }

  return NextResponse.json({
    data: {
      byGroup,
      byUser,
      aggregateReminders,
      summary: {
        totalPayments,
        totalSendEmail,
        totalSendTelegram,
        skipReasonCounts,
      },
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  let body: z.infer<typeof postNotifyUnpaidSchema> = {};
  try {
    const raw = await req.json();
    body = postNotifyUnpaidSchema.parse(raw ?? {});
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid request body" } },
      { status: 400 }
    );
  }

  const channelPreference: ChannelOverride = body.channelPreference ?? "both";

  const store = await db();
  const adminId = session.user.id;
  const userEmail = (session.user.email as string) || "";
  const now = new Date();

  const allForUser = await store.listGroupsForUser(adminId, userEmail);
  const groups = allForUser.filter(
    (g) =>
      g.adminId === adminId &&
      g.isActive &&
      g.notifications.remindersEnabled !== false
  );

  const adminGroupIds = new Set(groups.map((g) => g.id));
  const filterGroupIds =
    body.groupIds?.length && body.groupIds.every((id) => adminGroupIds.has(id))
      ? new Set(body.groupIds)
      : null;
  const filterPaymentIds = body.paymentIds?.length ? new Set(body.paymentIds) : null;

  const groupIds = filterGroupIds ? Array.from(filterGroupIds) : groups.map((g) => g.id);

  const periods: StorageBillingPeriod[] =
    groupIds.length === 0
      ? []
      : await store.getOpenBillingPeriods({
          asOf: now,
          unpaidOnly: true,
          groupIds,
        });

  let emailSent = 0;
  let telegramSent = 0;
  let skipped = 0;
  let failed = 0;

  const periodIdsUpdated = new Set<string>();

  const byEmail = new Map<
    string,
    {
      representativeEmail: string;
      memberNickname: string;
      inputs: AggregatedPaymentInput[];
    }
  >();

  for (const period of periods) {
    const group = await store.getGroup(period.groupId);
    if (!group || group.adminId !== adminId) continue;

    for (const payment of period.payments) {
      const p = payment as StorageMemberPayment;
      if (p.status !== "pending" && p.status !== "overdue") continue;
      if (filterPaymentIds && !filterPaymentIds.has(p.id)) continue;

      const eligibility = await getReminderEligibility({
        group,
        period,
        payment: p,
      });
      let sendEmail = eligibility.sendEmail;
      let sendTelegram = eligibility.sendTelegram;
      if (channelPreference === "email") sendTelegram = false;
      if (channelPreference === "telegram") sendEmail = false;
      if (!sendEmail && !sendTelegram) {
        skipped += 1;
        continue;
      }
      const input: AggregatedPaymentInput = { group, period, payment: p };
      const key = normalizeMemberEmailForAggregation(p.memberEmail);
      let entry = byEmail.get(key);
      if (!entry) {
        entry = {
          representativeEmail: p.memberEmail,
          memberNickname: p.memberNickname,
          inputs: [],
        };
        byEmail.set(key, entry);
      }
      entry.inputs.push(input);
    }
  }

  const periodRecipientCounts = new Map<string, number>();
  for (const [, { representativeEmail, memberNickname, inputs }] of byEmail) {
    if (inputs.length === 0) continue;
    try {
      const result = await sendAggregatedReminder(
        representativeEmail,
        memberNickname,
        inputs,
        { channelOverride: channelPreference }
      );
      if (result.emailSent) emailSent += 1;
      if (result.telegramSent) telegramSent += 1;
      if (result.emailSent || result.telegramSent) {
        const periodIds = new Set(inputs.map((i) => i.period.id ?? ""));
        for (const periodIdStr of periodIds) {
          if (!periodIdStr) continue;
          periodIdsUpdated.add(periodIdStr);
          periodRecipientCounts.set(
            periodIdStr,
            (periodRecipientCounts.get(periodIdStr) ?? 0) + 1
          );
        }
      }
    } catch {
      failed += 1;
    }
  }

  for (const periodIdStr of periodIdsUpdated) {
    const period = periods.find((pr) => pr.id === periodIdStr);
    if (!period) continue;
    const recipientCount = periodRecipientCounts.get(periodIdStr) ?? 1;
    const fresh = await store.getBillingPeriod(periodIdStr, period.groupId);
    if (!fresh) continue;
    const nextType: "initial" | "follow_up" =
      fresh.reminders.length === 0 ? "initial" : "follow_up";
    await store.updateBillingPeriod(periodIdStr, {
      reminders: [
        ...fresh.reminders,
        {
          sentAt: new Date(),
          channel: "email",
          recipientCount,
          type: nextType,
        },
      ],
    });
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
