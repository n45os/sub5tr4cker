import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/storage";
import type { StorageGroup, StorageNotificationType } from "@/lib/storage/types";
import {
  getFirstReminderEligibleAt,
  resolveCollectionOpensAt,
} from "@/lib/billing/collection-window";

const NOTIFICATION_TYPES: StorageNotificationType[] = [
  "payment_reminder",
  "payment_confirmed",
  "admin_confirmation_request",
  "price_change",
  "price_adjustment",
  "announcement",
  "invite",
  "follow_up",
  "member_message",
];
const CHANNELS = ["email", "telegram"] as const;

function canAccessGroup(
  group: StorageGroup,
  userId: string,
  userEmail: string
): boolean {
  if (group.adminId === userId) return true;
  return group.members.some(
    (m) =>
      m.isActive &&
      !m.leftAt &&
      (m.userId === userId ||
        m.email.toLowerCase() === userEmail.toLowerCase())
  );
}

// next run of reminders (daily 10:00) and follow-ups (14:00 every 3 days: 1,4,7,...)
function getNextReminderRunTimes(withinDays: number): Date[] {
  const runs: Date[] = [];
  const now = new Date();
  for (let d = 0; d < withinDays; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    date.setHours(10, 0, 0, 0);
    if (date > now) runs.push(date);
  }
  return runs;
}

function getNextFollowUpRunTimes(count: number): Date[] {
  const runs: Date[] = [];
  const now = new Date();
  const dayOfMonthForFollowUp = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28];
  let found = 0;
  for (let d = 0; d < 31 && found < count; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dom = date.getDate();
    if (!dayOfMonthForFollowUp.includes(dom)) continue;
    date.setHours(14, 0, 0, 0);
    if (date > now) {
      runs.push(date);
      found++;
    }
  }
  return runs;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const typeFilter = searchParams.get("type") || undefined;
  const channelFilter = searchParams.get("channel") || undefined;
  const sourceFilter = searchParams.get("source") || "all"; // "all" | "actions" | "notifications"

  if (typeFilter && !NOTIFICATION_TYPES.includes(typeFilter as StorageNotificationType)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid type filter" } },
      { status: 400 }
    );
  }
  if (channelFilter && !CHANNELS.includes(channelFilter as (typeof CHANNELS)[number])) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid channel filter" } },
      { status: 400 }
    );
  }
  if (!["all", "actions", "notifications"].includes(sourceFilter)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid source filter" } },
      { status: 400 }
    );
  }

  const store = await db();

  const userId = session.user.id;
  const userEmail = (session.user.email as string) || "";

  const groups = await store.listAllActiveGroups();
  const allowedGroupIds = groups
    .filter((g) => canAccessGroup(g, userId, userEmail))
    .map((g) => g.id);

  if (allowedGroupIds.length === 0) {
    return NextResponse.json({
      data: {
        sent: { items: [], pagination: { page: 1, totalPages: 0, total: 0 } },
        upcoming: [],
      },
    });
  }

  type SentItem =
    | {
        source: "notification";
        _id: string;
        type: string;
        channel: string;
        status: string;
        subject: string | null;
        preview: string;
        recipientEmail: string;
        externalId: string | null;
        hasEmailParams: boolean;
        groupId: string | null;
        billingPeriodId: string | null;
        deliveredAt: string | null;
        createdAt: string;
      }
    | {
        source: "action";
        _id: string;
        type: string;
        actorName: string;
        action: string;
        groupId: string | null;
        billingPeriodId: string | null;
        targetMemberId: string | null;
        metadata: Record<string, unknown>;
        createdAt: string;
      };

  let sent: {
    items: SentItem[];
    pagination: { page: number; totalPages: number; total: number };
  };

  if (sourceFilter === "notifications") {
    const { total: totalSent, notifications: sentNotifications } =
      await store.listNotifications({
        groupIds: allowedGroupIds,
        type: typeFilter as StorageNotificationType | undefined,
        channel: channelFilter as "email" | "telegram" | undefined,
        limit,
        offset: (page - 1) * limit,
      });
    const totalPages = Math.max(1, Math.ceil(totalSent / limit));
    sent = {
      items: sentNotifications.map((n) => ({
        source: "notification" as const,
        _id: n.id,
        type: n.type,
        channel: n.channel,
        status: n.status,
        subject: n.subject,
        preview: n.preview,
        recipientEmail: n.recipientEmail,
        externalId: n.externalId ?? null,
        hasEmailParams: !!n.emailParams,
        groupId: n.groupId ?? null,
        billingPeriodId: n.billingPeriodId ?? null,
        deliveredAt: n.deliveredAt ? n.deliveredAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: { page, totalPages, total: totalSent },
    };
  } else if (sourceFilter === "actions") {
    const { total: totalActions, events: auditEvents } =
      await store.listAuditEvents({
        groupIds: allowedGroupIds,
        limit,
        offset: (page - 1) * limit,
      });
    const totalPages = Math.max(1, Math.ceil(totalActions / limit));
    sent = {
      items: auditEvents.map((a) => ({
        source: "action" as const,
        _id: a.id,
        type: "action",
        actorName: a.actorName,
        action: a.action,
        groupId: a.groupId ?? null,
        billingPeriodId: a.billingPeriodId ?? null,
        targetMemberId: a.targetMemberId ?? null,
        metadata: a.metadata ?? {},
        createdAt: a.createdAt.toISOString(),
      })),
      pagination: { page, totalPages, total: totalActions },
    };
  } else {
    const [{ notifications }, { events: auditEvents }] = await Promise.all([
      store.listNotifications({
        groupIds: allowedGroupIds,
        type: typeFilter as StorageNotificationType | undefined,
        channel: channelFilter as "email" | "telegram" | undefined,
      }),
      store.listAuditEvents({ groupIds: allowedGroupIds, unbounded: true }),
    ]);
    const notifItems: SentItem[] = notifications.map((n) => ({
      source: "notification" as const,
      _id: n.id,
      type: n.type,
      channel: n.channel,
      status: n.status,
      subject: n.subject,
      preview: n.preview,
      recipientEmail: n.recipientEmail,
      externalId: n.externalId ?? null,
      hasEmailParams: !!n.emailParams,
      groupId: n.groupId ?? null,
      billingPeriodId: n.billingPeriodId ?? null,
      deliveredAt: n.deliveredAt ? n.deliveredAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    }));
    const actionItems: SentItem[] = auditEvents.map((a) => ({
      source: "action" as const,
      _id: a.id,
      type: "action",
      actorName: a.actorName,
      action: a.action,
      groupId: a.groupId ?? null,
      billingPeriodId: a.billingPeriodId ?? null,
      targetMemberId: a.targetMemberId ?? null,
      metadata: a.metadata ?? {},
      createdAt: a.createdAt.toISOString(),
    }));
    const merged = [...notifItems, ...actionItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const total = merged.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = merged.slice((page - 1) * limit, page * limit);
    sent = { items, pagination: { page, totalPages, total } };
  }

  const upcoming: Array<{
    at: string;
    type: "payment_reminder" | "admin_confirmation_request";
    summary: string;
    groups: Array<{ groupId: string; groupName: string; periodLabel: string; recipientCount?: number }>;
  }> = [];

  const reminderRuns = getNextReminderRunTimes(14);
  for (const runAt of reminderRuns) {
    const periods = await store.getOpenBillingPeriods({
      groupIds: allowedGroupIds,
      asOf: runAt,
      unpaidOnly: true,
    });

    const groupsInRun: Array<{
      groupId: string;
      groupName: string;
      periodLabel: string;
      recipientCount: number;
    }> = [];
    for (const period of periods) {
      const hasReminderTarget = period.payments.some(
        (p) => p.status === "pending" || p.status === "overdue"
      );
      if (!hasReminderTarget) continue;

      const g = await store.getGroup(period.groupId);
      if (!g?.isActive || g.notifications?.remindersEnabled === false) continue;

      const graceDays = g.billing.gracePeriodDays ?? 3;
      const collectionOpensAt = resolveCollectionOpensAt({
        periodStart: period.periodStart,
        collectionOpensAt: period.collectionOpensAt,
      });
      const firstReminderAt = getFirstReminderEligibleAt(
        collectionOpensAt,
        graceDays
      );
      if (runAt < firstReminderAt) continue;
      const recipientCount = period.payments.filter(
        (p) => p.status === "pending" || p.status === "overdue"
      ).length;
      if (recipientCount === 0) continue;
      groupsInRun.push({
        groupId: period.groupId,
        groupName: g.name,
        periodLabel: period.periodLabel,
        recipientCount,
      });
    }
    if (groupsInRun.length > 0) {
      upcoming.push({
        at: runAt.toISOString(),
        type: "payment_reminder",
        summary: `Payment reminders (${groupsInRun.reduce((s, x) => s + x.recipientCount, 0)} recipients)`,
        groups: groupsInRun,
      });
    }
  }

  const followUpRuns = getNextFollowUpRunTimes(5);
  for (const runAt of followUpRuns) {
    const periods = await store.getOpenBillingPeriods({
      groupIds: allowedGroupIds,
      asOf: runAt,
      unpaidOnly: true,
    });

    const groupsInRun: Array<{
      groupId: string;
      groupName: string;
      periodLabel: string;
      recipientCount?: number;
    }> = [];
    for (const period of periods) {
      const hasFollowUpTarget = period.payments.some(
        (p) => p.status === "member_confirmed"
      );
      if (!hasFollowUpTarget) continue;

      const g = await store.getGroup(period.groupId);
      if (!g?.isActive || g.notifications?.followUpsEnabled === false) continue;
      groupsInRun.push({
        groupId: period.groupId,
        groupName: g.name,
        periodLabel: period.periodLabel,
      });
    }
    if (groupsInRun.length > 0) {
      upcoming.push({
        at: runAt.toISOString(),
        type: "admin_confirmation_request",
        summary: `Admin verification reminder (${groupsInRun.length} period(s))`,
        groups: groupsInRun,
      });
    }
  }

  upcoming.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const upcomingCapped = upcoming.slice(0, 30);

  return NextResponse.json({
    data: {
      sent,
      upcoming: upcomingCapped,
    },
  });
}
