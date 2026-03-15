import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberGroupView } from "@/components/features/groups/member-group-view";
import { MemberTelegramLink } from "@/components/features/groups/member-telegram-link";
import { verifyMemberPortalToken } from "@/lib/tokens";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod } from "@/models";
import type { IGroupMember, IMemberPayment, IBillingPeriod } from "@/models";

function TokenError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link expired or invalid</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default async function MemberPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;

  const payload = await verifyMemberPortalToken(token);
  if (!payload) {
    return (
      <TokenError message="This link has expired or is invalid. Ask the group admin to resend your invite." />
    );
  }

  await dbConnect();

  const group = await Group.findById(payload.groupId);
  if (!group || !group.isActive) {
    return (
      <TokenError message="This group is no longer available." />
    );
  }

  const member = group.members.find(
    (m: IGroupMember) =>
      m._id.toString() === payload.memberId && m.isActive && !m.leftAt
  );
  if (!member) {
    return (
      <TokenError message="Your membership is no longer active in this group." />
    );
  }

  const activeMembers = group.members.filter(
    (m: IGroupMember) => m.isActive && !m.leftAt
  );

  const periods = await BillingPeriod.find({ group: group._id })
    .sort({ periodStart: -1 })
    .limit(24)
    .lean<IBillingPeriod[]>();

  const memberPeriods = periods.map((p) => ({
    _id: p._id.toString(),
    periodStart: p.periodStart.toISOString().slice(0, 10),
    periodLabel: p.periodLabel,
    totalPrice: p.totalPrice,
    isFullyPaid: p.isFullyPaid,
    payments: p.payments
      .filter((pay: IMemberPayment) => pay.memberId.toString() === payload.memberId)
      .map((pay: IMemberPayment) => ({
        memberId: pay.memberId.toString(),
        memberNickname: pay.memberNickname,
        amount: pay.amount,
        status: pay.status,
        memberConfirmedAt: pay.memberConfirmedAt
          ? pay.memberConfirmedAt.toISOString()
          : null,
        adminConfirmedAt: pay.adminConfirmedAt
          ? pay.adminConfirmedAt.toISOString()
          : null,
      })),
  }));

  const confirmed = query.confirmed === "true";
  const joined = query.joined === "true";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg font-semibold tracking-tight text-foreground"
          >
            sub5tr4cker
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {confirmed && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            Payment confirmed! The admin will verify it shortly.
          </div>
        )}
        {joined && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            Welcome to {group.name}! You can bookmark this page to check your payment status anytime.
          </div>
        )}

        <MemberGroupView
          group={{
            _id: group._id.toString(),
            name: group.name,
            description: group.description,
            service: group.service,
            billing: group.billing,
            payment: group.payment,
            memberCount: activeMembers.length,
            myMembership: {
              _id: member._id.toString(),
              nickname: member.nickname,
              role: member.role,
            },
          }}
          periods={memberPeriods}
          currentMemberId={member._id.toString()}
          memberToken={token}
        />

        {member.user && (
          <div className="mt-6">
            <MemberTelegramLink portalToken={token} />
          </div>
        )}
      </main>
    </div>
  );
}
