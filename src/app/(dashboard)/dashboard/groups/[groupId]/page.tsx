import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CreditCard, Pencil, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
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
import { PaymentMatrix } from "@/components/features/billing/payment-matrix";
import { GroupMembersPanel } from "@/components/features/groups/group-members-panel";
import { InitializeNotifyButton } from "@/components/features/groups/initialize-notify-button";
import { InviteLinkCard } from "@/components/features/groups/invite-link-card";
import { GroupNotificationsPanel } from "@/components/features/notifications/group-notifications-panel";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getServerBaseUrl } from "@/lib/server-url";

interface GroupDetail {
  _id: string;
  name: string;
  description: string | null;
  service: { name: string; icon: string | null; url: string | null };
  billing: {
    mode: "equal_split" | "fixed_amount" | "variable";
    currentPrice: number;
    currency: string;
    cycleDay: number;
    cycleType: "monthly" | "yearly";
    adminIncludedInSplit: boolean;
    fixedMemberAmount: number | null;
    gracePeriodDays: number;
  };
  payment: {
    platform: string;
    link: string | null;
    instructions: string | null;
  };
  notifications: {
    remindersEnabled: boolean;
    followUpsEnabled: boolean;
    priceChangeEnabled: boolean;
  };
  role: string;
  initializedAt: string | null;
  members: Array<{
    _id: string;
    email: string;
    nickname: string;
    role: string;
    customAmount: number | null;
  }>;
}

interface BillingPeriodItem {
  _id: string;
  periodLabel: string;
  totalPrice: number;
  payments: Array<{
    memberId: string;
    memberNickname: string;
    amount: number;
    status: string;
    memberConfirmedAt: string | null;
    adminConfirmedAt: string | null;
  }>;
  isFullyPaid: boolean;
}

interface NotificationItem {
  _id: string;
  type: string;
  channel: string;
  status: string;
  subject: string | null;
  preview: string;
  recipientEmail: string;
  createdAt: string;
}

async function getGroup(
  groupId: string,
  cookieHeader: string
): Promise<GroupDetail | null> {
  const baseUrl = await getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/groups/${groupId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

async function getBillingPeriods(
  groupId: string,
  cookieHeader: string
): Promise<BillingPeriodItem[]> {
  const baseUrl = await getServerBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/groups/${groupId}/billing?limit=24`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.data?.periods ?? [];
}

async function getNotifications(
  groupId: string,
  cookieHeader: string
): Promise<NotificationItem[]> {
  const baseUrl = await getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/notifications?groupId=${groupId}&limit=12`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  return json.data?.notifications ?? [];
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const session = await auth();

  const [group, periods, notifications] = await Promise.all([
    getGroup(groupId, cookieHeader),
    getBillingPeriods(groupId, cookieHeader),
    getNotifications(groupId, cookieHeader),
  ]);

  if (!group) notFound();

  const currentPeriod = periods[0];
  const currentMemberId =
    (session?.user?.email &&
      group.members.find((m) => m.email === session.user.email)?._id) ??
    null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              {group.service.icon || "ST"} {group.service.name}
            </Badge>
            <Badge variant={group.role === "admin" ? "default" : "secondary"}>
              {group.role}
            </Badge>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">{group.name}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {group.description ||
                "No extra description yet. Use the edit view to add payment notes, account context, or membership rules."}
            </p>
          </div>
        </div>

        {group.role === "admin" ? (
          <div className="flex flex-wrap items-center gap-2">
            <InitializeNotifyButton
              groupId={groupId}
              memberCount={group.members.length}
              initializedAt={group.initializedAt}
            />
            <Link
              href={`/dashboard/groups/${groupId}/edit`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Pencil className="size-4" />
              Edit group
            </Link>
          </div>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current price</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">
              {group.billing.currentPrice} {group.billing.currency}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="size-4" />
            {group.billing.mode.replace("_", " ")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Members</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">{group.members.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            Active participants
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cycle cadence</CardDescription>
            <CardTitle className="font-mono text-3xl capitalize">
              {group.billing.cycleType}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
            <CalendarDays className="size-4" />
            Day {group.billing.cycleDay} of each cycle
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open billing periods</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">
              {periods.filter((period) => !period.isFullyPaid).length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {currentPeriod
              ? `Latest period: ${currentPeriod.periodLabel}`
              : "No billing periods yet"}
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <Card>
              <CardHeader>
                <CardTitle>Billing setup</CardTitle>
                <CardDescription>
                  A quick summary of how this group is configured today.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-muted/35 p-4">
                  <p className="text-sm text-muted-foreground">Payment platform</p>
                  <p className="mt-2 font-medium capitalize">
                    {group.payment.platform.replace("_", " ")}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/35 p-4">
                  <p className="text-sm text-muted-foreground">Grace period</p>
                  <p className="font-mono mt-2 font-medium tabular-nums">
                    {group.billing.gracePeriodDays} day
                    {group.billing.gracePeriodDays !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/35 p-4">
                  <p className="text-sm text-muted-foreground">Admin in split</p>
                  <p className="mt-2 font-medium">
                    {group.billing.adminIncludedInSplit ? "Included" : "Excluded"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/35 p-4">
                  <p className="text-sm text-muted-foreground">Payment link</p>
                  <p className="mt-2 line-clamp-2 font-medium">
                    {group.payment.link || "No payment link configured"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What happens next</CardTitle>
                <CardDescription>
                  The billing workflow currently attached to this group.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-xl border p-4">
                  Billing periods use the {group.billing.cycleType} cycle and start on
                  day {group.billing.cycleDay}.
                </div>
                <div className="rounded-xl border p-4">
                  Members are reminded after the {group.billing.gracePeriodDays}-day grace
                  window if their payment is still pending.
                </div>
                <div className="rounded-xl border p-4">
                  {currentPeriod
                    ? `The latest tracked cycle is ${currentPeriod.periodLabel}.`
                    : "Create or wait for the first billing period to unlock payment tracking."}
                </div>
              </CardContent>
            </Card>
            {group.role === "admin" ? (
              <InviteLinkCard groupId={groupId} />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="members">
          <GroupMembersPanel
            groupId={groupId}
            members={group.members}
            currency={group.billing.currency}
            isAdmin={group.role === "admin"}
            periods={periods}
          />
        </TabsContent>

        <TabsContent value="billing">
          {!currentPeriod ? (
            <Card>
              <CardHeader>
                <CardTitle>No billing periods yet</CardTitle>
                <CardDescription>
                  Periods are created automatically on the configured cycle day, or
                  manually for variable billing.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <PaymentMatrix
              groupId={groupId}
              currency={group.billing.currency}
              periods={periods}
              members={group.members.map((m) => ({
                _id: m._id,
                nickname: m.nickname,
                email: m.email,
              }))}
              isAdmin={group.role === "admin"}
              currentMemberId={currentMemberId}
            />
          )}
        </TabsContent>

        <TabsContent value="notifications">
          <GroupNotificationsPanel
            groupId={groupId}
            isAdmin={group.role === "admin"}
            initialPreferences={group.notifications}
            recentNotifications={notifications}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
