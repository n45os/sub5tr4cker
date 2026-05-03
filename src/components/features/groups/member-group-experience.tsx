"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MemberPaymentList } from "@/components/features/billing/member-payment-list";
import { ContactAdminForm } from "@/components/features/groups/contact-admin-form";

export interface MemberGroupExperienceGroup {
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
    paymentInAdvanceDays?: number;
  };
  payment: {
    platform: string;
    link: string | null;
    instructions: string | null;
  };
  memberCount: number;
  myMembership?: { _id: string; nickname: string; role: string };
}

export interface MemberGroupExperiencePeriod {
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

export interface MemberIdentity {
  type: "session" | "portal";
  id: string;
  displayName: string;
  /** portal token, present iff type === "portal" */
  token?: string;
}

interface MemberGroupExperienceProps {
  group: MemberGroupExperienceGroup;
  billingPeriods: MemberGroupExperiencePeriod[];
  identity: MemberIdentity;
  initialPayPeriodId?: string | null;
  initialOpenConfirm?: boolean;
}

const MEMBER_PERIOD_PREVIEW_COUNT = 6;
const MAX_FUTURE_PREVIEW = 2;

/** Unified member-facing group body. Same React tree for portal-token and logged-in-member contexts. */
export function MemberGroupExperience({
  group,
  billingPeriods,
  identity,
  initialPayPeriodId,
  initialOpenConfirm,
}: MemberGroupExperienceProps) {
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const paymentBoardRef = useRef<HTMLDivElement | null>(null);

  // cap future periods to the 2 nearest, newest-first
  const { cappedPeriods, nonFuturePeriods, hiddenFutureCount } = useMemo(() => {
    const now = new Date();
    const future = billingPeriods.filter(
      (p) => p.periodStart && new Date(p.periodStart) > now
    );
    const nearest2 = future.slice(-MAX_FUTURE_PREVIEW);
    const nonFuture = billingPeriods.filter(
      (p) => !p.periodStart || new Date(p.periodStart) <= now
    );
    return {
      cappedPeriods: [...nearest2, ...nonFuture],
      nonFuturePeriods: nonFuture,
      hiddenFutureCount: future.length - nearest2.length,
    };
  }, [billingPeriods]);

  const visiblePeriods = useMemo(() => {
    if (showAllPeriods) return billingPeriods;
    return cappedPeriods.slice(0, MEMBER_PERIOD_PREVIEW_COUNT);
  }, [billingPeriods, cappedPeriods, showAllPeriods]);
  const hasHiddenPeriods =
    billingPeriods.length > MEMBER_PERIOD_PREVIEW_COUNT && !showAllPeriods;
  const currentPeriod = cappedPeriods[0];

  // financial summary based only on current + past periods (not future)
  const myPayments = identity.id
    ? nonFuturePeriods.flatMap((p) =>
        p.payments.filter((pay) => pay.memberId === identity.id)
      )
    : [];
  const totalPending = myPayments
    .filter((p) => p.status === "pending" || p.status === "member_confirmed")
    .reduce((s, p) => s + p.amount, 0);
  const totalOverdue = myPayments
    .filter((p) => p.status === "overdue")
    .reduce((s, p) => s + p.amount, 0);
  const nextDuePeriod = billingPeriods.find((p) =>
    p.payments.some(
      (pay) =>
        pay.memberId === identity.id &&
        (pay.status === "pending" || pay.status === "overdue")
    )
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
            {group.description || "No description for this group yet."}
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

      {/* payment board */}
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
            <CardHeader className="pb-2">
              <CardTitle>Your payment status</CardTitle>
              <CardDescription>
                Your amount and status per period.
                {hiddenFutureCount > 0 &&
                  ` ${hiddenFutureCount} more future period${hiddenFutureCount !== 1 ? "s" : ""} available.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemberPaymentList
                groupId={group._id}
                currency={group.billing.currency}
                periods={visiblePeriods}
                currentMemberId={identity.id || null}
                memberToken={identity.token}
                paymentPlatform={group.payment.platform}
                paymentLink={group.payment.link}
                paymentInstructions={group.payment.instructions}
                initialSelectedPeriodId={initialPayPeriodId ?? null}
                initialOpenConfirm={initialOpenConfirm}
              />
              {billingPeriods.length > MEMBER_PERIOD_PREVIEW_COUNT && (
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
              Billing periods use the {group.billing.cycleType} cycle and start
              on day {group.billing.cycleDay}.
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
      </section>

      <ContactAdminForm groupId={group._id} memberToken={identity.token} />
    </div>
  );
}
