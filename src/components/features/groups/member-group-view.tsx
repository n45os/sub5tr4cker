"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, CreditCard, AlertTriangle, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MemberPaymentList } from "@/components/features/billing/member-payment-list";
import { PaymentMatrix } from "@/components/features/billing/payment-matrix";
import { ContactAdminForm } from "@/components/features/groups/contact-admin-form";

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

interface MemberGroupViewProps {
  group: MemberGroupViewGroup;
  periods: MemberGroupViewPeriod[];
  currentMemberId: string | null;
  /** portal token for unauthenticated member actions */
  memberToken?: string;
}

const MEMBER_PERIOD_PREVIEW_COUNT = 6;
const MAX_FUTURE_PREVIEW = 2;

/** Member-safe group content: no members list, no notifications, no edit/invite. Reused by dashboard and standalone member page. */
export function MemberGroupView({
  group,
  periods,
  currentMemberId,
  memberToken,
}: MemberGroupViewProps) {
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const paymentBoardRef = useRef<HTMLDivElement | null>(null);
  const myMembership = group.myMembership;
  const membersForMatrix = myMembership
    ? [{ _id: myMembership._id, nickname: myMembership.nickname, email: "" }]
    : [];

  // same logic as admin: cap future periods to 2 nearest, newest first
  const now = new Date();
  const nearest2Future = periods
    .filter((p) => p.periodStart && new Date(p.periodStart) > now)
    .slice(-MAX_FUTURE_PREVIEW);
  const nonFuturePeriods = periods.filter(
    (p) => !p.periodStart || new Date(p.periodStart) <= now
  );
  const hiddenFutureCount = periods.filter(
    (p) => p.periodStart && new Date(p.periodStart) > now
  ).length - nearest2Future.length;
  const cappedPeriods = [...nearest2Future, ...nonFuturePeriods];

  const visiblePeriods = useMemo(() => {
    if (!memberToken) return cappedPeriods;
    if (showAllPeriods) return periods;
    return cappedPeriods.slice(0, MEMBER_PERIOD_PREVIEW_COUNT);
  }, [memberToken, cappedPeriods, periods, showAllPeriods]);
  const hasHiddenPeriods =
    !!memberToken && periods.length > MEMBER_PERIOD_PREVIEW_COUNT && !showAllPeriods;
  const currentPeriod = cappedPeriods[0];

  // financial summary based only on current + past periods (not future)
  const myPayments = currentMemberId
    ? nonFuturePeriods.flatMap((p) =>
        p.payments.filter((pay) => pay.memberId === currentMemberId),
      )
    : [];
  const totalPending = myPayments
    .filter((p) => p.status === "pending" || p.status === "member_confirmed")
    .reduce((s, p) => s + p.amount, 0);
  const totalOverdue = myPayments
    .filter((p) => p.status === "overdue")
    .reduce((s, p) => s + p.amount, 0);
  const nextDuePeriod = periods.find((p) =>
    p.payments.some(
      (pay) =>
        pay.memberId === currentMemberId &&
        (pay.status === "pending" || pay.status === "overdue"),
    ),
  );

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

      {/* financial summary */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">
              {totalPending.toFixed(2)} {group.billing.currency}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            Awaiting confirmation
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">
              {totalOverdue.toFixed(2)} {group.billing.currency}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-4 text-destructive" />
            Past grace period
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Next due</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {nextDuePeriod ? nextDuePeriod.periodLabel : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {nextDuePeriod ? "Upcoming cycle" : "All clear"}
          </CardContent>
        </Card>
      </section>

      {/* payment board first */}
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
        <div ref={paymentBoardRef} className="w-fit max-w-full">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Your payment status</CardTitle>
                <CardDescription>
                  Your amount and status per period.
                  {!memberToken && " Open the full list to see all."}
                  {hiddenFutureCount > 0 && ` ${hiddenFutureCount} more future period${hiddenFutureCount !== 1 ? "s" : ""} available.`}
                </CardDescription>
              </div>
              {!memberToken && (
                <Link
                  href={`/dashboard/groups/${group._id}/billing`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink className="mr-2 size-4" />
                  View all periods
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {memberToken ? (
                <>
                  <MemberPaymentList
                    groupId={group._id}
                    currency={group.billing.currency}
                    periods={visiblePeriods}
                    currentMemberId={currentMemberId}
                    memberToken={memberToken}
                  />
                  {periods.length > MEMBER_PERIOD_PREVIEW_COUNT && (
                    <div className="mt-4 flex justify-end">
                      {hasHiddenPeriods ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowAllPeriods(true);
                            requestAnimationFrame(() => {
                              paymentBoardRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            });
                          }}
                        >
                          Load all periods
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllPeriods(false)}
                        >
                          Show less
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <PaymentMatrix
                  groupId={group._id}
                  currency={group.billing.currency}
                  periods={visiblePeriods}
                  members={membersForMatrix}
                  isAdmin={false}
                  currentMemberId={currentMemberId}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

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

      <ContactAdminForm groupId={group._id} memberToken={memberToken} />
    </div>
  );
}
