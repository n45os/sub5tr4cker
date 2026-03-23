import Link from "next/link";
import { cookies } from "next/headers";
import { Bell, CreditCard, Users } from "lucide-react";
import { AdminServicesTable } from "@/components/features/dashboard/admin-services-table";
import { GroupCard } from "@/components/features/groups/GroupCard";
import { AllGroupsQuickStatus } from "@/components/features/dashboard/all-groups-quick-status";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServerBaseUrl } from "@/lib/server-url";

interface GroupSummary {
  _id: string;
  name: string;
  service: { name: string; icon: string | null };
  role: string;
  memberCount: number;
  billing: { currentPrice: number; currency: string; mode: string };
  nextBillingDate: string;
  unpaidCount: number;
}

async function getGroups(cookieHeader: string): Promise<GroupSummary[]> {
  const baseUrl = await getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/groups`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data?.groups ?? [];
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const groups = await getGroups(cookieHeader);
  const adminGroups = groups.filter((g) => g.role === "admin");
  const totalMembers = groups.reduce((sum, group) => sum + group.memberCount, 0);
  const totalPending = groups.reduce((sum, group) => sum + group.unpaidCount, 0);
  const totalSpend = groups.reduce(
    (sum, group) => sum + group.billing.currentPrice,
    0
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 overflow-x-hidden">
      <section className="grid gap-4 lg:grid-cols-[1.5fr_repeat(3,1fr)] *:min-w-0">
        <Card className="border-border/70 bg-gradient-to-br from-card via-card to-muted/40 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Ops snapshot
            </Badge>
            <CardTitle className="text-3xl">Run every subscription from one place</CardTitle>
            <CardDescription className="max-w-xl text-sm">
              Track owners, unpaid balances, and upcoming cycles without bouncing
              between env files, message drafts, and ad-hoc spreadsheets.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total groups</CardDescription>
            <CardTitle className="text-3xl">{groups.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="size-4" />
            Active subscriptions
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Members tracked</CardDescription>
            <CardTitle className="text-3xl">{totalMembers}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            Across every active group
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending confirmations</CardDescription>
            <CardTitle className="text-3xl">{totalPending}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bell className="size-4" />
            Members still waiting for follow-up
          </CardContent>
        </Card>
      </section>

      {adminGroups.length > 0 ? (
        <section>
          <AdminServicesTable groups={adminGroups} />
        </section>
      ) : null}

      <section>
        <AllGroupsQuickStatus />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.8fr_1fr] *:min-w-0">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Your groups</CardTitle>
              <CardDescription>
                Review pricing, due dates, and unpaid balances at a glance.
              </CardDescription>
            </div>
            <Link href="/dashboard/groups/new">
              <Badge variant="accent" className="px-3 py-1 text-sm">New group</Badge>
            </Link>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
                <p className="text-base font-medium">
                  You do not have any subscription groups yet.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your first group to start managing reminders, billing
                  periods, and member confirmations from one dashboard.
                </p>
                <Link
                  href="/dashboard/groups/new"
                  className="mt-5 inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Create your first group
                </Link>
              </div>
            ) : (
              <ul className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                {groups.map((group) => (
                  <li key={group._id}>
                    <GroupCard group={group} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace pulse</CardTitle>
            <CardDescription>
              A quick read on the current portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Tracked spend</p>
              <p className="font-mono mt-2 text-2xl font-semibold tabular-nums">
                {totalSpend.toFixed(2)} {groups[0]?.billing.currency ?? "EUR"}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Groups needing attention</p>
              <p className="font-mono mt-2 text-2xl font-semibold tabular-nums">
                {groups.filter((group) => group.unpaidCount > 0).length}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Healthy groups</p>
              <p className="font-mono mt-2 text-2xl font-semibold tabular-nums">
                {groups.filter((group) => group.unpaidCount === 0).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
