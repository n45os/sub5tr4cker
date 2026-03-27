import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type { ChannelOverride } from "@/lib/notifications/reminder-send";
import {
  sendAggregatedReminder,
  type AggregatedReminderRecipient,
  type AggregatedPaymentInput,
} from "@/lib/notifications/aggregated-reminder-send";
import {
  getRecipientKey,
  getRecipientLabel,
} from "@/lib/notifications/member-email";
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
        memberId: string;
        memberEmail: string | null;
        recipientLabel: string;
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
      memberId: string;
      memberEmail: string | null;
      recipientLabel: string;
      memberNickname: string;
      amount: number;
      currency: string;
      status: string;
      sendEmail: boolean;
      sendTelegram: boolean;
      skipReasons: SkipReason[];
    }> = [];

    for (const payment of unpaidPayments) {
      const member = group.members.find((entry) => entry.id === payment.memberId);
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
        memberId: eligibility.memberId,
        memberEmail: eligibility.memberEmail,
        recipientLabel: getRecipientLabel({
          memberId: eligibility.memberId,
          memberEmail: eligibility.memberEmail,
          memberNickname: eligibility.memberNickname,
          memberUserId: member?.userId ?? null,
        }),
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
    memberId: string;
    memberEmail: string | null;
    recipientLabel: string;
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
    recipientKey: string;
    memberEmail: string | null;
    recipientLabel: string;
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

  const byRecipient = new Map<
    string,
    {
      recipient: AggregatedReminderRecipient;
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
        const member = groups
          .find((group) => group.id === ge.groupId)
          ?.members.find((entry) => entry.id === pay.memberId);
        const key = getRecipientKey({
          memberId: pay.memberId,
          memberEmail: pay.memberEmail,
          memberNickname: pay.memberNickname,
          memberUserId: member?.userId ?? null,
        });
        const el: PaymentEligibility = {
          paymentId: pay.paymentId,
          memberId: pay.memberId,
          memberEmail: pay.memberEmail,
          recipientLabel: pay.recipientLabel,
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
        let entry = byRecipient.get(key);
        if (!entry) {
          entry = {
            recipient: {
              memberId: pay.memberId,
              memberEmail: pay.memberEmail,
              memberName: pay.memberNickname,
              memberUserId: member?.userId ?? null,
              recipientLabel: pay.recipientLabel,
            },
            memberNickname: pay.memberNickname,
            sendEmail: false,
            sendTelegram: false,
            skipReasons: new Set(),
            payments: [],
          };
          byRecipient.set(key, entry);
        }
        entry.payments.push(el);
        if (pay.sendEmail) entry.sendEmail = true;
        if (pay.sendTelegram) entry.sendTelegram = true;
        for (const r of pay.skipReasons) entry.skipReasons.add(r);
      }
    }
  }
  for (const [key, entry] of byRecipient) {
    const totalAmount = entry.payments.reduce((s, p) => s + p.amount, 0);
    byUser.push({
      recipientKey: key,
      memberEmail: entry.recipient.memberEmail ?? null,
      recipientLabel: entry.recipient.recipientLabel ?? entry.memberNickname,
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
  const periodChannels = new Map<string, Set<"email" | "telegram">>();

  const byRecipient = new Map<
    string,
    {
      recipient: AggregatedReminderRecipient;
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
      const member = group.members.find((entry) => entry.id === p.memberId);
      const key = getRecipientKey({
        memberId: p.memberId,
        memberEmail: p.memberEmail,
        memberNickname: p.memberNickname,
        memberUserId: member?.userId ?? null,
      });
      let entry = byRecipient.get(key);
      if (!entry) {
        entry = {
          recipient: {
            memberId: p.memberId,
            memberUserId: member?.userId ?? null,
            memberEmail: p.memberEmail,
            memberName: p.memberNickname,
            recipientLabel: getRecipientLabel({
              memberId: p.memberId,
              memberEmail: p.memberEmail,
              memberNickname: p.memberNickname,
              memberUserId: member?.userId ?? null,
            }),
          },
          memberNickname: p.memberNickname,
          inputs: [],
        };
        byRecipient.set(key, entry);
      }
      entry.inputs.push(input);
    }
  }

  const periodRecipientCounts = new Map<string, number>();
  for (const [, { recipient, memberNickname, inputs }] of byRecipient) {
    if (inputs.length === 0) continue;
    try {
      const recipientPayload: AggregatedReminderRecipient = {
        ...recipient,
        memberName: memberNickname,
      };
      const result = await sendAggregatedReminder(recipientPayload, inputs, {
        channelOverride: channelPreference,
      });
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
          const channels = periodChannels.get(periodIdStr) ?? new Set<"email" | "telegram">();
          if (result.emailSent) channels.add("email");
          if (result.telegramSent) channels.add("telegram");
          periodChannels.set(periodIdStr, channels);
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
    const channels = Array.from(periodChannels.get(periodIdStr) ?? []);
    const fresh = await store.getBillingPeriod(periodIdStr, period.groupId);
    if (!fresh) continue;
    const nextType: "initial" | "follow_up" =
      fresh.reminders.length === 0 ? "initial" : "follow_up";
    await store.updateBillingPeriod(periodIdStr, {
      reminders: [
        ...fresh.reminders,
        ...(channels.length > 0
          ? channels.map((channel) => ({
              sentAt: new Date(),
              channel,
              recipientCount,
              type: nextType,
            }))
          : [
              {
                sentAt: new Date(),
                channel: "email" as const,
                recipientCount,
                type: nextType,
              },
            ]),
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
