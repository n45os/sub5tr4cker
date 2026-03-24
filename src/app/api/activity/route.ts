import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { AuditEvent, Group, BillingPeriod, Notification } from "@/models";
import type { NotificationType } from "@/models";
import {
  collectionWindowOpenFilter,
  getFirstReminderEligibleAt,
  resolveCollectionOpensAt,
} from "@/lib/billing/collection-window";

const NOTIFICATION_TYPES: NotificationType[] = [
  "payment_reminder",
  "payment_confirmed",
  "admin_confirmation_request",
  "price_change",
  "announcement",
  "invite",
  "follow_up",
];
const CHANNELS = ["email", "telegram"] as const;

type GroupLike = {
  admin: { toString: () => string };
  members: Array<{
    isActive?: boolean;
    leftAt?: Date | null;
    user?: { toString: () => string } | null;
    email: string;
  }>;
};

function canAccessGroup(
  group: GroupLike,
  userId: string,
  userEmail: string
): boolean {
  if (group.admin.toString() === userId) return true;
  return group.members.some(
    (m) =>
      m.isActive &&
      !m.leftAt &&
      (m.user?.toString() === userId || m.email === userEmail)
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

  if (typeFilter && !NOTIFICATION_TYPES.includes(typeFilter as NotificationType)) {
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

  await dbConnect();

  const userId = session.user.id;
  const userEmail = (session.user.email as string) || "";

  const groups = await Group.find({ isActive: true }).lean();
  const allowedGroupIds = groups
    .filter((g) => canAccessGroup(g as unknown as GroupLike, userId, userEmail))
    .map((g) => g._id);

  if (allowedGroupIds.length === 0) {
    return NextResponse.json({
      data: {
        sent: { items: [], pagination: { page: 1, totalPages: 0, total: 0 } },
        upcoming: [],
      },
    });
  }

  const sentQuery: Record<string, unknown> = { group: { $in: allowedGroupIds } };
  if (typeFilter) sentQuery.type = typeFilter;
  if (channelFilter) sentQuery.channel = channelFilter;

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
    const totalSent = await Notification.countDocuments(sentQuery);
    const totalPages = Math.max(1, Math.ceil(totalSent / limit));
    const sentNotifications = await Notification.find(sentQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    sent = {
      items: sentNotifications.map((n) => ({
        source: "notification" as const,
        _id: n._id.toString(),
        type: n.type,
        channel: n.channel,
        status: n.status,
        subject: n.subject,
        preview: n.preview,
        recipientEmail: n.recipientEmail,
        externalId: n.externalId ?? null,
        groupId: n.group?.toString() ?? null,
        billingPeriodId: n.billingPeriod?.toString() ?? null,
        deliveredAt: n.deliveredAt ? n.deliveredAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: { page, totalPages, total: totalSent },
    };
  } else if (sourceFilter === "actions") {
    const actionQuery: Record<string, unknown> = {
      group: { $in: allowedGroupIds },
    };
    const totalActions = await AuditEvent.countDocuments(actionQuery);
    const totalPages = Math.max(1, Math.ceil(totalActions / limit));
    const auditEvents = await AuditEvent.find(actionQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    sent = {
      items: auditEvents.map((a) => ({
        source: "action" as const,
        _id: a._id.toString(),
        type: "action",
        actorName: a.actorName,
        action: a.action,
        groupId: a.group?.toString() ?? null,
        billingPeriodId: a.billingPeriod?.toString() ?? null,
        targetMemberId: a.targetMember?.toString() ?? null,
        metadata: (a.metadata as Record<string, unknown>) ?? {},
        createdAt: a.createdAt.toISOString(),
      })),
      pagination: { page, totalPages, total: totalActions },
    };
  } else {
    const [notifications, auditEvents] = await Promise.all([
      Notification.find(sentQuery).sort({ createdAt: -1 }).lean(),
      AuditEvent.find({ group: { $in: allowedGroupIds } })
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    const notifItems: SentItem[] = notifications.map((n) => ({
      source: "notification" as const,
      _id: n._id.toString(),
      type: n.type,
      channel: n.channel,
      status: n.status,
      subject: n.subject,
      preview: n.preview,
      recipientEmail: n.recipientEmail,
      externalId: n.externalId ?? null,
      groupId: n.group?.toString() ?? null,
      billingPeriodId: n.billingPeriod?.toString() ?? null,
      deliveredAt: n.deliveredAt ? n.deliveredAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    }));
    const actionItems: SentItem[] = auditEvents.map((a) => ({
      source: "action" as const,
      _id: a._id.toString(),
      type: "action",
      actorName: a.actorName,
      action: a.action,
      groupId: a.group?.toString() ?? null,
      billingPeriodId: a.billingPeriod?.toString() ?? null,
      targetMemberId: a.targetMember?.toString() ?? null,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
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
    const periods = await BillingPeriod.find({
      group: { $in: allowedGroupIds },
      isFullyPaid: false,
      ...collectionWindowOpenFilter(runAt),
      "payments.status": { $in: ["pending", "overdue"] },
    })
      .populate("group")
      .lean();

    const groupsInRun: Array<{
      groupId: string;
      groupName: string;
      periodLabel: string;
      recipientCount: number;
    }> = [];
    for (const period of periods) {
      const group = period.group as { _id: unknown; name: string; billing?: { gracePeriodDays?: number }; notifications?: { remindersEnabled?: boolean } };
      if (!group || !group.name) continue;
      const g = await Group.findById(group._id);
      if (!g?.isActive || g.notifications?.remindersEnabled === false) continue;
      const graceDays = g.billing.gracePeriodDays ?? 3;
      const collectionOpensAt = resolveCollectionOpensAt({
        periodStart: period.periodStart as Date,
        collectionOpensAt: period.collectionOpensAt as Date | null | undefined,
      });
      const firstReminderAt = getFirstReminderEligibleAt(
        collectionOpensAt,
        graceDays
      );
      if (runAt < firstReminderAt) continue;
      const recipientCount = (period.payments as Array<{ status: string }>).filter(
        (p) => p.status === "pending" || p.status === "overdue"
      ).length;
      if (recipientCount === 0) continue;
      const groupIdStr =
        typeof period.group === "object" && period.group !== null && "_id" in period.group
          ? String((period.group as { _id: unknown })._id)
          : String(period.group);
      groupsInRun.push({
        groupId: groupIdStr,
        groupName: group.name,
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
    const periods = await BillingPeriod.find({
      group: { $in: allowedGroupIds },
      isFullyPaid: false,
      ...collectionWindowOpenFilter(runAt),
      "payments.status": "member_confirmed",
    })
      .populate("group")
      .lean();

    const groupsInRun: Array<{
      groupId: string;
      groupName: string;
      periodLabel: string;
      recipientCount?: number;
    }> = [];
    for (const period of periods) {
      const group = period.group as { _id: unknown; name: string };
      if (!group?.name) continue;
      const g = await Group.findById(group._id);
      if (!g?.isActive || g.notifications?.followUpsEnabled === false) continue;
      const groupIdStr =
        typeof period.group === "object" && period.group !== null && "_id" in period.group
          ? String((period.group as { _id: unknown })._id)
          : String(period.group);
      groupsInRun.push({
        groupId: groupIdStr,
        groupName: group.name,
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
