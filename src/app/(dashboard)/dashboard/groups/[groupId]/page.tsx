import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { GroupDetailAdminActions } from "@/components/features/groups/group-detail-admin-actions";
import { NoPeriodsCard } from "@/components/features/billing/no-periods-card";
import { PaymentMatrix } from "@/components/features/billing/payment-matrix";
import { GroupMembersPanel } from "@/components/features/groups/group-members-panel";
import { InviteLinkCard } from "@/components/features/groups/invite-link-card";
import { MemberGroupExperience } from "@/components/features/groups/member-group-experience";
import { CollapsibleNotificationsPanel } from "@/components/features/notifications/collapsible-notifications-panel";
import { auth } from "@/lib/auth";
import { getNextPeriodStart } from "@/lib/billing/calculator";
import { getServerBaseUrl } from "@/lib/server-url";

const BILLING_PERIODS_LIMIT = 50;

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
  members?: MemberRow[];
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
  limit = BILLING_PERIODS_LIMIT
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

function formatDateShort(iso: Date | string | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
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

  const [periods, notifications] = await Promise.all([
    getBillingPeriods(groupId, cookieHeader),
    getNotifications(groupId, cookieHeader, isAdmin),
  ]);

  const now = new Date();
  const nonFuturePeriods = periods.filter(
    (p) => !p.periodStart || new Date(p.periodStart) <= now
  );
  const currentMemberId =
    myMembership?._id ??
    (session?.user?.email && members.find((m) => m.email === session.user.email)?._id) ??
    null;

  // member view: same React tree as the public /member/[token] portal
  if (!isAdmin) {
    const memberPeriods = periods.slice(0, 24);
    const memberId = currentMemberId ?? myMembership?._id ?? "";
    const displayName =
      myMembership?.nickname ??
      (session?.user?.name as string | undefined) ??
      (session?.user?.email as string | undefined) ??
      "Member";
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <MemberGroupExperience
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
          billingPeriods={memberPeriods}
          identity={{
            type: "session",
            id: memberId,
            displayName,
          }}
        />
      </div>
    );
  }

  const unpaidCount = nonFuturePeriods.reduce((sum, period) => {
    return (
      sum +
      period.payments.filter(
        (p) => p.status === "pending" || p.status === "overdue"
      ).length
    );
  }, 0);
  const nextBillingDate = formatDateShort(getNextPeriodStart(group.billing.cycleDay));
  const cycleLabel =
    group.billing.cycleType === "monthly"
      ? `monthly · day ${group.billing.cycleDay}`
      : `yearly · day ${group.billing.cycleDay}`;
  const subline = [
    `${group.billing.currentPrice} ${group.billing.currency}`,
    cycleLabel,
    `${memberCount} member${memberCount === 1 ? "" : "s"}`,
    `${unpaidCount} unpaid`,
    `next ${nextBillingDate}`,
  ].join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      {/* section 1 — at-a-glance + actions */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              {group.service.icon || "ST"} {group.service.name}
            </Badge>
            <Badge variant="default">admin</Badge>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">{group.name}</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
              {subline}
            </p>
            {group.description && (
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                {group.description}
              </p>
            )}
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
          unpaidCount={unpaidCount}
        />
      </section>

      {/* section 2 — billing & payments (full matrix inline) */}
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Billing & payments</h3>
          <p className="text-sm text-muted-foreground">
            Every tracked period for this group. Click a cell to confirm, reject, waive, or adjust.
          </p>
        </div>
        {periods.length === 0 ? (
          <NoPeriodsCard groupId={groupId} cycleDay={group.billing.cycleDay} />
        ) : (
          <PaymentMatrix
            groupId={groupId}
            currency={group.billing.currency}
            periods={periods}
            members={members.map((m) => ({ _id: m._id, nickname: m.nickname, email: m.email }))}
            isAdmin
            currentMemberId={currentMemberId}
            billingMode={group.billing.mode}
          />
        )}
      </section>

      {/* section 3 — members & invites */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Members & invites</h3>
          <p className="text-sm text-muted-foreground">
            Manage who&apos;s on this group, send invites, and tune notification delivery.
          </p>
        </div>
        <GroupMembersPanel
          groupId={groupId}
          members={members}
          currency={group.billing.currency}
          isAdmin
          periods={periods.slice(0, 6)}
        />
        <InviteLinkCard groupId={groupId} />
        <CollapsibleNotificationsPanel
          groupId={groupId}
          isAdmin
          initialPreferences={group.notifications}
          recentNotifications={notifications}
        />
      </section>
    </div>
  );
}
