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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getServerBaseUrl } from "@/lib/server-url";
import { cn } from "@/lib/utils";

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
  type,
  channel,
  source,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  type?: string;
  channel?: string;
  source?: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      {currentPage > 1 && (
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
      )}
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages} ({total} total)
      </span>
      {currentPage < totalPages && (
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
      )}
    </div>
  );
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <Activity className="size-5" />
            Activity log
          </CardTitle>
          <CardDescription>
            Notifications sent and actions taken across your groups. Use
            filters to narrow by type, channel, or source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sent" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="sent">Sent &amp; actions</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            </TabsList>
            <TabsContent value="sent" className="mt-4">
              <ActivityFilters params={params} />
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
                                {item.recipientEmail}
                              </span>
                              {item.groupId && (
                                <Link
                                  href={`/dashboard/groups/${item.groupId}`}
                                  className="text-primary hover:underline"
                                >
                                  View group
                                </Link>
                              )}
                            </div>
                            <p className="max-w-full truncate text-sm text-muted-foreground">
                              {item.subject ?? item.preview}
                            </p>
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
                  {totalPages > 1 && (
                    <ActivityPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      total={pagination.total}
                      type={params.type}
                      channel={params.channel}
                      source={params.source}
                    />
                  )}
                </>
              )}
            </TabsContent>
            <TabsContent value="upcoming" className="mt-4">
              {upcoming.length === 0 ? (
                <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
                  No upcoming reminder or follow-up runs in the next two weeks.
                  Add billing periods with unpaid balances to see scheduled
                  activity here.
                </div>
              ) : (
                <ul className="space-y-4">
                  {upcoming.map((evt, i) => (
                    <li
                      key={`${evt.at}-${i}`}
                      className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium tabular-nums">
                          {formatDate(evt.at)}
                        </span>
                        <Badge variant="outline" className="gap-1">
                          {evt.type === "payment_reminder" ? (
                            <Bell className="size-3" />
                          ) : (
                            <ShieldAlert className="size-3" />
                          )}
                          {evt.type === "payment_reminder"
                            ? "Reminders"
                            : "Admin follow-up"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {evt.summary}
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {evt.groups.map((g) => (
                          <li key={String(g.groupId)}>
                            <Link
                              href={`/dashboard/groups/${String(g.groupId)}`}
                              className="text-primary hover:underline"
                            >
                              {g.groupName}
                            </Link>
                            <span className="text-muted-foreground">
                              {" "}
                              — {g.periodLabel}
                              {g.recipientCount != null
                                ? ` (${g.recipientCount} recipient${g.recipientCount !== 1 ? "s" : ""})`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
