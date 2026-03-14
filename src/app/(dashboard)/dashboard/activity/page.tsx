import { cookies } from "next/headers";
import Link from "next/link";
import { Activity, Mail, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getServerBaseUrl } from "@/lib/server-url";

interface SentNotification {
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
      notifications: SentNotification[];
      pagination: { page: number; totalPages: number; total: number };
    };
    upcoming: UpcomingEvent[];
  };
}

async function getActivity(
  cookieHeader: string,
  params: { page?: string; type?: string; channel?: string }
): Promise<ActivityResponse["data"] | null> {
  const baseUrl = await getServerBaseUrl();
  const search = new URLSearchParams();
  if (params.page) search.set("page", params.page);
  if (params.type) search.set("type", params.type);
  if (params.channel) search.set("channel", params.channel);
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
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function buildActivityQuery(params: {
  page: number;
  type?: string;
  channel?: string;
}): string {
  const q: Record<string, string> = { page: String(params.page) };
  if (params.type) q.type = params.type;
  if (params.channel) q.channel = params.channel;
  return new URLSearchParams(q).toString();
}

function ActivityPagination({
  currentPage,
  totalPages,
  total,
  type,
  channel,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  type?: string;
  channel?: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <Link
          href={`/dashboard/activity?${buildActivityQuery({
            page: currentPage - 1,
            type,
            channel,
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

function typeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "telegram") return <MessageCircle className="size-4" />;
  return <Mail className="size-4" />;
}

interface ActivityPageProps {
  searchParams: Promise<{ page?: string; type?: string; channel?: string }>;
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
  const { notifications, pagination } = sent;
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Activity log
          </CardTitle>
          <CardDescription>
            Sent notifications and scheduled reminder/follow-up runs across your
            groups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sent" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            </TabsList>
            <TabsContent value="sent" className="mt-4">
              <form
                method="get"
                action="/dashboard/activity"
                className="mb-4 flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="page" value="1" />
                <select
                  name="type"
                  defaultValue={params.type ?? ""}
                  className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
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
                <select
                  name="channel"
                  defaultValue={params.channel ?? ""}
                  className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">All channels</option>
                  <option value="email">Email</option>
                  <option value="telegram">Telegram</option>
                </select>
                <Button type="submit" variant="secondary" size="sm">
                  Apply
                </Button>
              </form>
              {notifications.length === 0 ? (
                <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
                  No notifications have been sent yet. Reminders and follow-ups
                  will appear here once sent.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead>Subject / Preview</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notifications.map((n) => (
                        <TableRow key={n._id}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {formatDate(n.deliveredAt ?? n.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {typeLabel(n.type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1">
                              <ChannelIcon channel={n.channel} />
                              {n.channel}
                            </span>
                          </TableCell>
                          <TableCell>{n.recipientEmail}</TableCell>
                          <TableCell>
                            {n.groupId ? (
                              <Link
                                href={`/dashboard/groups/${String(n.groupId)}`}
                                className="text-primary hover:underline"
                              >
                                View group
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {n.subject ?? n.preview}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                n.status === "sent"
                                  ? "default"
                                  : n.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {n.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <ActivityPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      total={pagination.total}
                      type={params.type}
                      channel={params.channel}
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
                        <span className="font-medium">
                          {formatDate(evt.at)}
                        </span>
                        <Badge variant="outline">
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
