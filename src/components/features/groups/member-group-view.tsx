import { CalendarDays, CreditCard, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaymentMatrix } from "@/components/features/billing/payment-matrix";

export interface MemberGroupViewGroup {
  _id: string;
  name: string;
  description: string | null;
  service: { name: string; icon: string | null; url: string | null };
  billing: {
    mode: string;
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
  memberCount: number;
  myMembership?: { _id: string; nickname: string; role: string };
}

export interface MemberGroupViewPeriod {
  _id: string;
  periodStart: string;
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

interface MemberGroupViewProps {
  group: MemberGroupViewGroup;
  periods: MemberGroupViewPeriod[];
  currentMemberId: string | null;
}

/** Member-safe group content: no members list, no notifications, no edit/invite. Reused by dashboard and standalone member page. */
export function MemberGroupView({
  group,
  periods,
  currentMemberId,
}: MemberGroupViewProps) {
  const currentPeriod = periods[0];
  const myMembership = group.myMembership;
  const membersForMatrix = myMembership
    ? [{ _id: myMembership._id, nickname: myMembership.nickname, email: "" }]
    : [];

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">
            {group.service.icon || "ST"} {group.service.name}
          </Badge>
          <Badge variant="secondary">member</Badge>
        </div>
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            {group.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {group.description ||
              "No extra description yet. Use the edit view to add payment notes, account context, or membership rules."}
          </p>
        </div>
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
            <CardTitle className="font-mono text-3xl tabular-nums">
              {group.memberCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            On this plan
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
              {periods.filter((p) => !p.isFullyPaid).length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {currentPeriod
              ? `Latest period: ${currentPeriod.periodLabel}`
              : "No billing periods yet"}
          </CardContent>
        </Card>
      </section>

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
              Billing periods use the {group.billing.cycleType} cycle and start
              on day {group.billing.cycleDay}.
            </div>
            <div className="rounded-xl border p-4">
              Members are reminded after the {group.billing.gracePeriodDays}-day
              grace window if their payment is still pending.
            </div>
            <div className="rounded-xl border p-4">
              {currentPeriod
                ? `The latest tracked cycle is ${currentPeriod.periodLabel}.`
                : "Create or wait for the first billing period to unlock payment tracking."}
            </div>
          </CardContent>
        </Card>
      </section>

      {!currentPeriod ? (
        <Card>
          <CardHeader>
            <CardTitle>Your payment status</CardTitle>
            <CardDescription>
              No billing periods have been created for this group yet. Your
              status will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <PaymentMatrix
          groupId={group._id}
          currency={group.billing.currency}
          periods={periods}
          members={membersForMatrix}
          isAdmin={false}
          currentMemberId={currentMemberId}
        />
      )}
    </div>
  );
}
