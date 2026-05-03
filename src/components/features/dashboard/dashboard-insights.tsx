import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CreditCard,
  Mail,
  MessageCircle,
  Settings2,
  Users,
  Wallet,
} from "lucide-react";
import { AdminServicesTable } from "@/components/features/dashboard/admin-services-table";
import { AllGroupsQuickStatus } from "@/components/features/dashboard/all-groups-quick-status";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface InsightsGroup {
  _id: string;
  role: string;
  memberCount: number;
  billing: { currentPrice: number; currency: string; mode: string };
  unpaidCount: number;
}

interface DashboardInsightsProps {
  groups: InsightsGroup[];
}

export function DashboardInsights({ groups }: DashboardInsightsProps) {
  const adminGroups = groups.filter((g) => g.role === "admin");
  const adminGroupsNeedingAttention = adminGroups.filter(
    (g) => g.unpaidCount > 0
  ).length;
  const adminHealthyGroups = adminGroups.filter(
    (g) => g.unpaidCount === 0
  ).length;
  const totalMembers = groups.reduce(
    (sum, group) => sum + group.memberCount,
    0
  );
  const totalPending = groups.reduce(
    (sum, group) => sum + group.unpaidCount,
    0
  );
  const totalSpend = groups.reduce(
    (sum, group) => sum + group.billing.currentPrice,
    0
  );
  const currency = groups[0]?.billing.currency ?? "EUR";

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-[1.5fr_repeat(3,1fr)] *:min-w-0">
        <Card className="border-border/70 bg-linear-to-br from-card via-card to-muted/40 shadow-sm">
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

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] *:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Common admin actions</CardTitle>
            <CardDescription>
              Jump straight to the tasks you do most often without digging through the
              sidebar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                href: "/dashboard/groups/new",
                title: "Create group",
                description: "Add a new subscription and invite members",
                icon: CreditCard,
              },
              {
                href: "/dashboard/payments",
                title: "Review payments",
                description: "Check open balances and payment state",
                icon: Wallet,
              },
              {
                href: "/dashboard/activity",
                title: "Open delivery log",
                description: "See sent notifications and recent actions",
                icon: Mail,
              },
              {
                href: "/dashboard/scheduled-tasks",
                title: "Scheduled sends",
                description: "Inspect queued reminders and follow-ups",
                icon: CalendarClock,
              },
              {
                href: "/dashboard/notifications",
                title: "Notifications hub",
                description: "Manage email, Telegram, and templates",
                icon: MessageCircle,
              },
              {
                href: "/dashboard/settings",
                title: "Workspace settings",
                description: "Open app URL, secrets, cron, and plugins",
                icon: Settings2,
              },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="block">
                <div className="flex h-full flex-col gap-2 rounded-2xl border border-border/70 bg-muted/20 p-4 transition-colors hover:bg-muted/35">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <item.icon className="size-4 text-muted-foreground" />
                    {item.title}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hidden no more</CardTitle>
            <CardDescription>
              The parts of the workspace admins kept having to hunt for.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link
              href="/dashboard/activity"
              className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:bg-muted/25"
            >
              <p className="text-sm font-medium">Delivery log</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sent notifications, failures, previews, and admin actions.
              </p>
            </Link>
            <Link
              href="/dashboard/scheduled-tasks"
              className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:bg-muted/25"
            >
              <p className="text-sm font-medium">Scheduled sends</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Review upcoming or stuck reminder tasks before they become invisible.
              </p>
            </Link>
            <Link
              href="/dashboard/notifications"
              className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:bg-muted/25"
            >
              <p className="text-sm font-medium">Notifications hub</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure channels and preview templates from one screen.
              </p>
            </Link>
          </CardContent>
        </Card>
      </section>

      <section>
        <AllGroupsQuickStatus />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Workspace pulse</CardTitle>
            <CardDescription>
              A quick read on the current portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Tracked spend</p>
              <p className="font-mono mt-2 text-2xl font-semibold tabular-nums">
                {totalSpend.toFixed(2)} {currency}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Groups needing attention
              </p>
              <p className="font-mono mt-2 text-2xl font-semibold tabular-nums">
                {adminGroupsNeedingAttention}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Groups you own with open billing follow-ups
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Healthy groups</p>
              <p className="font-mono mt-2 text-2xl font-semibold tabular-nums">
                {adminHealthyGroups}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Owned groups with nothing outstanding
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
