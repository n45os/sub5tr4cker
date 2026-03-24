import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { NoPeriodsCard } from "@/components/features/billing/no-periods-card";
import { PaymentMatrix } from "@/components/features/billing/payment-matrix";
import { auth } from "@/lib/auth";
import { getServerBaseUrl } from "@/lib/server-url";

const BILLING_PAGE_LIMIT = 50;

interface MemberRow {
  _id: string;
  nickname: string;
  email: string;
}

interface GroupBillingDetail {
  _id: string;
  name: string;
  billing: {
    currency: string;
    cycleDay: number;
    mode?: "equal_split" | "fixed_amount" | "variable";
  };
  role: string;
  members?: MemberRow[];
  myMembership?: { _id: string; nickname: string } | null;
}

interface BillingPeriodItem {
  _id: string;
  periodStart: string;
  periodEnd?: string;
  periodLabel: string;
  totalPrice: number;
  priceNote?: string | null;
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

async function getGroup(
  groupId: string,
  cookieHeader: string
): Promise<GroupBillingDetail | null> {
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
  limit: number
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

export default async function GroupBillingPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const [group, session] = await Promise.all([
    getGroup(groupId, cookieHeader),
    auth(),
  ]);
  if (!group) notFound();

  const periodsRaw = await getBillingPeriods(
    groupId,
    cookieHeader,
    BILLING_PAGE_LIMIT
  );
  // newest first — API already returns periodStart desc
  const periods = periodsRaw;
  const currentPeriod = periods[0];
  const isAdmin = group.role === "admin";
  const adminMembers = group.members ?? [];
  const currentMemberId =
    group.myMembership?._id ??
    (session?.user?.email && adminMembers.find((m) => m.email === session.user.email)?._id) ??
    null;

  // for members, build a single-column matrix from myMembership
  const membersForMatrix = isAdmin
    ? adminMembers.map((m) => ({ _id: m._id, nickname: m.nickname, email: m.email }))
    : group.myMembership
      ? [{ _id: group.myMembership._id, nickname: group.myMembership.nickname, email: "" }]
      : [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/dashboard/groups/${groupId}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to group
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {isAdmin
            ? `Billing periods — ${group.name}`
            : `Your payment history — ${group.name}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "View, edit, and manage all billing periods. Use the group page for import history; create advance periods from the matrix below."
            : "Your payment status across all periods."}
        </p>
      </div>

      {!currentPeriod ? (
        <NoPeriodsCard groupId={groupId} cycleDay={group.billing.cycleDay} isAdmin={isAdmin} />
      ) : (
        <PaymentMatrix
          groupId={groupId}
          currency={group.billing.currency}
          periods={periods}
          members={membersForMatrix}
          isAdmin={isAdmin}
          currentMemberId={currentMemberId}
          billingMode={group.billing.mode ?? "equal_split"}
        />
      )}
    </div>
  );
}
