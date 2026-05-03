import { cookies } from "next/headers";
import Link from "next/link";
import {
  Activity,
  Bell,
  CheckCircle2,
  Mail,
  MessageCircle,
  ShieldAlert,
  Clock,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Wallet,
  Pencil,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServerBaseUrl } from "@/lib/server-url";
import { cn } from "@/lib/utils";
import { ActivityEmailPreview } from "@/components/features/activity/activity-email-preview";

type SentItem =
  | {
      source: "notification";
      _id: string;
      type: string;
      channel: string;
      status: string;
      subject: string | null;
      preview: string;
      recipientEmail: string | null;
      recipientLabel: string;
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

interface UpcomingEvent {
  at: string;
  type: "payment_reminder" | "admin_confirmation_request";
  summary: string;
  groups: Array<{
    groupId: string;
    groupName: string;
    periodLabel: string;
    recipientCount?: number;
  }>;
}

interface ActivityResponse {
  data: {
    sent: {
      items: SentItem[];
      pagination: { page: number; totalPages: number; total: number };
    };
    upcoming: UpcomingEvent[];
  };
}

async function getActivity(
  cookieHeader: string,
  params: {
    page?: string;
    type?: string;
    channel?: string;
    source?: string;
  }
): Promise<ActivityResponse["data"] | null> {
  const baseUrl = await getServerBaseUrl();
  const search = new URLSearchParams();
  if (params.page) search.set("page", params.page);
  if (params.type) search.set("type", params.type);
  if (params.channel) search.set("channel", params.channel);
  if (params.source) search.set("source", params.source);
  search.set("limit", "25");
  const res = await fetch(`${baseUrl}/api/activity?${search.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as ActivityResponse;
  return json.data ?? null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function buildActivityQuery(params: {
  page: number;
  type?: string;
  channel?: string;
  source?: string;
}): string {
  const q: Record<string, string> = { page: String(params.page) };
  if (params.type) q.type = params.type;
  if (params.channel) q.channel = params.channel;
  if (params.source) q.source = params.source;
  return new URLSearchParams(q).toString();
}

function typeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ");
}

function NotificationTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "payment_reminder":
      return <Bell className="size-4 text-primary" />;
    case "payment_confirmed":
      return <CheckCircle2 className="size-4 text-status-confirmed" />;
    case "admin_confirmation_request":
      return <ShieldAlert className="size-4 text-status-pending" />;
    case "follow_up":
      return <Clock className="size-4 text-amber-600 dark:text-amber-400" />;
    case "price_change":
      return <Wallet className="size-4 text-primary" />;
    case "invite":
      return <UserPlus className="size-4 text-primary" />;
    case "announcement":
      return <FileText className="size-4 text-muted-foreground" />;
    default:
      return <Activity className="size-4 text-muted-foreground" />;
  }
}

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case "payment_confirmed":
    case "payment_waived":
      return <CheckCircle2 className="size-4 text-status-confirmed" />;
    case "payment_self_confirmed":
      return <UserCheck className="size-4 text-status-member-confirmed" />;
    case "payment_rejected":
      return <UserMinus className="size-4 text-destructive" />;
    case "group_created":
    case "group_edited":
      return <Pencil className="size-4 text-primary" />;
    case "member_added":
      return <UserPlus className="size-4 text-primary" />;
    case "member_removed":
      return <UserMinus className="size-4 text-muted-foreground" />;
    case "member_updated":
      return <User className="size-4 text-primary" />;
    case "billing_period_created":
      return <Wallet className="size-4 text-primary" />;
    default:
      return <User className="size-4 text-primary" />;
  }
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "telegram")
    return <MessageCircle className="size-4 text-muted-foreground" />;
  return <Mail className="size-4 text-muted-foreground" />;
}

function ActivityFilters({
  params,
}: {
  params: { type?: string; channel?: string; source?: string };
}) {
  const selectClass =
    "h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20";
  return (
    <form
      method="get"
      action="/dashboard/activity"
      className="mb-4 flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="page" value="1" />
      <label htmlFor="activity-source" className="text-sm text-muted-foreground">
        Show:
      </label>
      <select
        id="activity-source"
        name="source"
        defaultValue={params.source ?? "all"}
        className={selectClass}
      >
        <option value="all">All</option>
        <option value="notifications">Notifications</option>
        <option value="actions">Actions</option>
      </select>
      <select name="type" defaultValue={params.type ?? ""} className={selectClass}>
        <option value="">All types</option>
        <option value="payment_reminder">Payment reminder</option>
        <option value="payment_confirmed">Payment confirmed</option>
        <option value="admin_confirmation_request">
          Admin confirmation request
        </option>
        <option value="follow_up">Follow up</option>
        <option value="price_change">Price change</option>
        <option value="invite">Invite</option>
        <option value="announcement">Announcement</option>
      </select>
      <select name="channel" defaultValue={params.channel ?? ""} className={selectClass}>
        <option value="">All channels</option>
        <option value="email">Email</option>
        <option value="telegram">Telegram</option>
      </select>
      <Button type="submit" variant="secondary" size="sm">
        Apply
      </Button>
    </form>
  );
}

function ActivityPagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  type,
  channel,
  source,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  type?: string;
  channel?: string;
  source?: string;
}) {
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  return (
    <div className="mt-6 flex flex-col items-center gap-2 border-t pt-4 sm:flex-row sm:justify-between">
      <span className="text-sm text-muted-foreground tabular-nums">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={`/dashboard/activity?${buildActivityQuery({
              page: currentPage - 1,
              type,
              channel,
              source,
            })}`}
          >
            <Button variant="outline" size="sm">
              Previous
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        <span className="text-sm text-muted-foreground tabular-nums">
          Page {currentPage} of {totalPages}
        </span>
        {currentPage < totalPages ? (
          <Link
            href={`/dashboard/activity?${buildActivityQuery({
              page: currentPage + 1,
              type,
              channel,
              source,
            })}`}
          >
            <Button variant="outline" size="sm">
              Next
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function countUpcomingNext24h(upcoming: UpcomingEvent[]): number {
  const now = Date.now();
  const cutoff = now + 24 * 60 * 60 * 1000;
  let count = 0;
  for (const evt of upcoming) {
    const at = new Date(evt.at).getTime();
    if (Number.isNaN(at)) continue;
    if (at >= now && at <= cutoff) {
      count += evt.groups.length || 1;
    }
  }
  return count;
}

interface ActivityPageProps {
  searchParams: Promise<{
    page?: string;
    type?: string;
    channel?: string;
    source?: string;
  }>;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const params = await searchParams;
  const data = await getActivity(cookieHeader, params);

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <p className="text-muted-foreground">Unable to load activity.</p>
      </div>
    );
  }

  const { sent, upcoming } = data;
  const { items, pagination } = sent;
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;
  const upcomingNext24h = countUpcomingNext24h(upcoming);
  const hasActiveFilters = Boolean(
    (params.source && params.source !== "all") || params.type || params.channel
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <Activity className="size-5" />
            Activity log
          </CardTitle>
          <CardDescription>
            Recent notifications and admin actions, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingNext24h > 0 && (
            <Link
              href="/dashboard/scheduled-tasks"
              className="mb-4 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-2 text-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                <span>
                  {upcomingNext24h} reminder
                  {upcomingNext24h === 1 ? "" : "s"} queued in the next 24h
                </span>
              </span>
              <span className="text-muted-foreground">→</span>
            </Link>
          )}
          <details className="mb-4 rounded-lg border bg-muted/10" open={hasActiveFilters}>
            <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium">
              Filters
            </summary>
            <div className="border-t px-4 py-3">
              <ActivityFilters params={params} />
            </div>
          </details>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
              No activity yet. Notifications and user actions will appear
              here once sent or performed.
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item._id}>
                    {item.source === "notification" ? (
                      <div
                        className={cn(
                          "flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/20",
                          "border-l-4 border-l-primary/50"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <NotificationTypeIcon type={item.type} />
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {formatDate(item.deliveredAt ?? item.createdAt)}
                          </span>
                          <Badge
                            variant="outline"
                            className="gap-1 font-normal capitalize"
                          >
                            {typeLabel(item.type)}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <ChannelIcon channel={item.channel} />
                            {item.channel}
                          </span>
                          <Badge
                            variant={
                              item.status === "sent"
                                ? "default"
                                : item.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {item.recipientLabel}
                          </span>
                          {item.groupId && (
                            <Link
                              href={`/dashboard/groups/${item.groupId}`}
                              className="text-primary hover:underline"
                            >
                              View group
                            </Link>
                          )}
                          {item.channel === "email" && item.hasEmailParams ? (
                            <ActivityEmailPreview notificationId={item._id} />
                          ) : null}
                        </div>
                        <p className="max-w-full truncate text-sm text-muted-foreground">
                          {item.subject ?? item.preview}
                        </p>
                        {item.channel === "email" && item.externalId && (
                          <p className="text-xs text-muted-foreground">
                            Message ID: {item.externalId}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/20",
                          "border-l-4 border-l-primary"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <ActionIcon action={item.action} />
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {formatDate(item.createdAt)}
                          </span>
                          <Badge
                            variant="secondary"
                            className="gap-1 font-normal capitalize"
                          >
                            {actionLabel(item.action)}
                          </Badge>
                          <span className="text-sm font-medium">
                            {item.actorName}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-2 text-sm text-muted-foreground">
                          {item.groupId && (
                            <Link
                              href={`/dashboard/groups/${item.groupId}`}
                              className="text-primary hover:underline"
                            >
                              View group
                            </Link>
                          )}
                          {item.metadata?.name != null && (
                            <span>· {String(item.metadata.name)}</span>
                          )}
                          {item.metadata?.nickname != null && (
                            <span>· {String(item.metadata.nickname)}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <ActivityPagination
                currentPage={currentPage}
                totalPages={totalPages}
                total={pagination.total}
                pageSize={25}
                type={params.type}
                channel={params.channel}
                source={params.source}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
