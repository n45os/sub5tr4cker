import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CreditCard, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GroupDetailAdminActions } from "@/components/features/groups/group-detail-admin-actions";
import { NoPeriodsCard } from "@/components/features/billing/no-periods-card";
import { PaymentMatrix } from "@/components/features/billing/payment-matrix";
import { GroupMembersPanel } from "@/components/features/groups/group-members-panel";
import { InviteLinkCard } from "@/components/features/groups/invite-link-card";
import { MemberGroupView } from "@/components/features/groups/member-group-view";
import { CollapsibleNotificationsPanel } from "@/components/features/notifications/collapsible-notifications-panel";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getServerBaseUrl } from "@/lib/server-url";

interface MemberRow {
  _id: string;
  email: string | null;
  nickname: string;
  role: string;
  customAmount: number | null;
  hasAccount: boolean;
  acceptedAt: string | null;
  billingStartsAt: string | null;
  emailConnected?: boolean;
  telegramConnected?: boolean;
  unsubscribedFromEmail?: boolean;
}

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
    paymentInAdvanceDays?: number;
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
    saveEmailParams: boolean;
  };
  role: string;
  initializedAt: string | null;
  /** present for admin; absent for member */
  members?: MemberRow[];
  /** present for member; absent for admin */
  memberCount?: number;
  myMembership?: Omit<MemberRow, "email">;
}

interface BillingPeriodItem {
  _id: string;
  periodStart: string;
  periodEnd?: string;
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
  recipientLabel: string;
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
  cookieHeader: string,
  limit = 24
): Promise<BillingPeriodItem[]> {
  const baseUrl = await getServerBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/groups/${groupId}/billing?limit=${limit}`,
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
  cookieHeader: string,
  isAdmin: boolean
): Promise<NotificationItem[]> {
  if (!isAdmin) return [];
  const baseUrl = await getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/notifications?groupId=${groupId}&limit=12`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return [];
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

  const group = await getGroup(groupId, cookieHeader);
  if (!group) notFound();

  const isAdmin = group.role === "admin";
  const members = group.members ?? [];
  const memberCount = group.memberCount ?? members.length;
  const myMembership = group.myMembership;

  const [periodsRaw, notifications] = await Promise.all([
    getBillingPeriods(groupId, cookieHeader, 12),
    getNotifications(groupId, cookieHeader, isAdmin),
  ]);
  // newest first, but only keep the 2 nearest future periods
  const now = new Date();
  const nearest2Future = periodsRaw
    .filter((p) => p.periodStart && new Date(p.periodStart) > now)
    .slice(-2);
  const nonFuturePeriods = periodsRaw.filter(
    (p) => !p.periodStart || new Date(p.periodStart) <= now
  );
  const hiddenFutureCount = periodsRaw.filter(
    (p) => p.periodStart && new Date(p.periodStart) > now
  ).length - nearest2Future.length;
  const periods = [...nearest2Future, ...nonFuturePeriods].slice(0, 6);
  const currentPeriod = periods[0];
  const acceptedCount = isAdmin
    ? members.filter((m) => !!m.acceptedAt).length
    : (myMembership?.acceptedAt ? 1 : 0);
  const currentMemberId =
    myMembership?._id ??
    (session?.user?.email && members.find((m) => m.email === session.user.email)?._id) ??
    null;

  // total owed as of today: only periods that have started (current + past), not future
  const totalOutstanding = nonFuturePeriods.reduce((sum, period) => {
    return sum + period.payments
      .filter((p: { status: string }) => p.status === "pending" || p.status === "overdue")
      .reduce((pSum: number, p: { amount: number }) => pSum + p.amount, 0);
  }, 0);

  // member view: show limited info within the dashboard shell
  if (!isAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <MemberGroupView
          group={{
            _id: group._id,
            name: group.name,
            description: group.description,
            service: group.service,
            billing: group.billing,
            payment: group.payment,
            memberCount,
            myMembership: group.myMembership,
          }}
          periods={periods}
          currentMemberId={currentMemberId}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              {group.service.icon || "ST"} {group.service.name}
            </Badge>
            <Badge variant="default">admin</Badge>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">{group.name}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {group.description ||
                "No extra description yet. Use the edit view to add payment notes, account context, or membership rules."}
            </p>
          </div>
        </div>

        <GroupDetailAdminActions
          groupId={groupId}
          groupName={group.name}
          memberCount={memberCount}
          initializedAt={group.initializedAt}
          memberEmails={members
            .map((m) => m.email)
            .filter((email): email is string => Boolean(email))}
          currency={group.billing.currency}
        />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            <CardTitle className="font-mono text-3xl tabular-nums">{memberCount}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            {acceptedCount}/{memberCount} accepted invites
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
            <CardDescription>Open periods</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">
              {periods.filter((period) => !period.isFullyPaid).length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {currentPeriod
              ? `Latest: ${currentPeriod.periodLabel}`
              : "No billing periods yet"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Owed until now</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">
              {totalOutstanding.toFixed(2)} {group.billing.currency}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-4" />
            Pending + overdue in current and past periods only
          </CardContent>
        </Card>
      </section>

      {/* payment board — recent 6 periods + link to full page */}
      {!currentPeriod ? (
        <NoPeriodsCard groupId={groupId} cycleDay={group.billing.cycleDay} />
      ) : (
        <div className="w-fit max-w-full">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Billing periods</CardTitle>
              <CardDescription>
                Latest periods.{hiddenFutureCount > 0 && ` ${hiddenFutureCount} more future period${hiddenFutureCount !== 1 ? "s" : ""} on the full page.`}{" "}
                Open the full list to edit, add, or view history.
              </CardDescription>
            </div>
            <Link
              href={`/dashboard/groups/${groupId}/billing`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              <ExternalLink className="mr-2 size-4" />
              View all periods
            </Link>
          </CardHeader>
          <CardContent>
            <PaymentMatrix
              groupId={groupId}
              currency={group.billing.currency}
              periods={periods}
              members={members.map((m) => ({ _id: m._id, nickname: m.nickname, email: m.email }))}
              isAdmin
              currentMemberId={currentMemberId}
              billingMode={group.billing.mode}
            />
          </CardContent>
        </Card>
        </div>
      )}

      <CollapsibleNotificationsPanel
        groupId={groupId}
        isAdmin
        initialPreferences={group.notifications}
        recentNotifications={notifications}
      />

      <GroupMembersPanel
        groupId={groupId}
        members={members}
        currency={group.billing.currency}
        isAdmin
        periods={periods}
      />

      {/* billing & workflow */}
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
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
              <p className="text-sm text-muted-foreground">Pay in advance</p>
              <p className="mt-2 font-medium">
                {(group.billing.paymentInAdvanceDays ?? 0) === 0
                  ? "Off (opens on renewal)"
                  : `${group.billing.paymentInAdvanceDays} day${
                      group.billing.paymentInAdvanceDays === 1 ? "" : "s"
                    } before renewal`}
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
              {(group.billing.paymentInAdvanceDays ?? 0) > 0 ? (
                <>
                  The collection window opens {group.billing.paymentInAdvanceDays}{" "}
                  day
                  {group.billing.paymentInAdvanceDays !== 1 ? "s" : ""} before each
                  renewal. Automated reminders start after a{" "}
                  {group.billing.gracePeriodDays}-day grace period from that moment if
                  payment is still pending.
                </>
              ) : (
                <>
                  Automated reminders start after a {group.billing.gracePeriodDays}
                  -day grace period from the renewal day (collection opens on renewal)
                  if payment is still pending.
                </>
              )}
            </div>
            <div className="rounded-xl border p-4">
              {currentPeriod
                ? `The latest tracked cycle is ${currentPeriod.periodLabel}.`
                : "Create or wait for the first billing period to unlock payment tracking."}
            </div>
          </CardContent>
        </Card>
        <InviteLinkCard groupId={groupId} />
      </section>

    </div>
  );
}
