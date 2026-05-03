import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberGroupExperience } from "@/components/features/groups/member-group-experience";
import { MemberTelegramLink } from "@/components/features/groups/member-telegram-link";
import { verifyMemberPortalToken } from "@/lib/tokens";
import { db } from "@/lib/storage";

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

  const store = await db();

  const group = await store.getGroup(payload.groupId);
  if (!group || !group.isActive) {
    return (
      <TokenError message="This group is no longer available." />
    );
  }

  const member = group.members.find(
    (m) =>
      m.id === payload.memberId && m.isActive && !m.leftAt
  );
  if (!member) {
    return (
      <TokenError message="Your membership is no longer active in this group." />
    );
  }

  const activeMembers = group.members.filter(
    (m) => m.isActive && !m.leftAt
  );

  const periodRows = await store.getPeriodsForGroup(group.id);
  const periods = periodRows.slice(0, 24);

  // chronological newest-first — no fancy reordering on the member portal
  const memberPeriods = periods.map((p) => ({
    _id: p.id,
    periodStart: p.periodStart.toISOString().slice(0, 10),
    periodEnd: p.periodEnd.toISOString().slice(0, 10),
    periodLabel: p.periodLabel,
    totalPrice: p.totalPrice,
    isFullyPaid: p.isFullyPaid,
    payments: p.payments
      .filter((pay) => pay.memberId === payload.memberId)
      .map((pay) => ({
        memberId: pay.memberId,
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
  const initialPayPeriodId =
    typeof query.pay === "string" && query.pay.trim() ? query.pay : null;
  const initialOpenConfirm = query.open === "confirm";

  // load user's telegram link state when member has an account (for "Connect Telegram" card)
  let telegramLinked = false;
  let telegramUsername: string | null = null;
  let telegramLinkedAt: string | null = null;
  if (member.userId) {
    const user = await store.getUser(member.userId);
    telegramLinked = Boolean(user?.telegram?.chatId);
    telegramUsername = user?.telegram?.username ?? null;
    telegramLinkedAt =
      user?.telegram?.linkedAt != null ? String(user.telegram.linkedAt) : null;
  }

  const memberViewGroup = {
    _id: group.id,
    name: group.name,
    description: group.description ?? null,
    service: {
      name: group.service.name,
      icon: group.service.icon ?? null,
      url: group.service.url ?? null,
    },
    billing: {
      mode: group.billing.mode,
      currentPrice: group.billing.currentPrice,
      currency: group.billing.currency,
      cycleDay: group.billing.cycleDay,
      cycleType: group.billing.cycleType,
      adminIncludedInSplit: group.billing.adminIncludedInSplit,
      fixedMemberAmount: group.billing.fixedMemberAmount ?? null,
      gracePeriodDays: group.billing.gracePeriodDays,
      paymentInAdvanceDays: group.billing.paymentInAdvanceDays ?? 0,
    },
    payment: {
      platform: group.payment.platform,
      link: group.payment.link ?? null,
      instructions: group.payment.instructions ?? null,
    },
    memberCount: activeMembers.length,
    myMembership: {
      _id: member.id,
      nickname: member.nickname,
      role: member.role,
    },
  };

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

        <MemberGroupExperience
          group={memberViewGroup}
          billingPeriods={memberPeriods}
          identity={{
            type: "portal",
            id: member.id,
            displayName: member.nickname,
            token,
          }}
          initialPayPeriodId={initialPayPeriodId}
          initialOpenConfirm={initialOpenConfirm}
        />

        {member.userId && (
          <div className="mt-6">
            <MemberTelegramLink
              portalToken={token}
              telegramLinked={telegramLinked}
              telegramUsername={telegramUsername}
              telegramLinkedAt={telegramLinkedAt}
            />
          </div>
        )}
      </main>
    </div>
  );
}
