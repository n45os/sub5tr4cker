import Link from "next/link";
import { ArrowRight, Bell, CreditCard, Users, Wallet } from "lucide-react";

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
  const openFollowUps = adminGroups.filter((g) => g.unpaidCount > 0).length;
  const membersOwing = groups.reduce((sum, g) => sum + g.unpaidCount, 0);
  const totalSpend = groups.reduce(
    (sum, g) => sum + g.billing.currentPrice,
    0
  );
  const currency = groups[0]?.billing.currency ?? "EUR";

  const tiles = [
    {
      label: "Open follow-ups",
      value: String(openFollowUps),
      hint: "Owned groups with unpaid members",
      icon: Bell,
    },
    {
      label: "Members owing",
      value: String(membersOwing),
      hint: "Across every group you're in",
      icon: Users,
    },
    {
      label: "Tracked spend",
      value: `${totalSpend.toFixed(2)} ${currency}`,
      hint: "Sum of current cycle prices",
      icon: Wallet,
    },
    {
      label: "Groups",
      value: String(groups.length),
      hint: "Active subscriptions",
      icon: CreditCard,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li
            key={tile.label}
            className="rounded-2xl border border-border/70 bg-muted/30 p-4"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <tile.icon className="size-4" />
              {tile.label}
            </div>
            <p className="font-mono mt-2 text-2xl font-semibold tabular-nums">
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/activity"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        View activity
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
