import Link from "next/link";
import { ArrowRight, CalendarDays, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export interface GroupCardData {
  _id: string;
  name: string;
  service: { name: string; icon: string | null };
  role: string;
  memberCount: number;
  billing: { currentPrice: number; currency: string; mode: string };
  nextBillingDate: string;
  unpaidCount: number;
}

export function GroupCard({ group }: { group: GroupCardData }) {
  const roleLabel = group.role === "admin" ? "Owner" : "Member";
  const healthLabel =
    group.unpaidCount > 0 ? `${group.unpaidCount} unpaid` : "Up to date";

  return (
    <Link
      href={`/dashboard/groups/${group._id}`}
      className="block transition-transform duration-200 hover:-translate-y-0.5"
    >
      <Card className="h-full border-border/70 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {group.service.icon || "ST"} {group.service.name}
              </p>
              <CardTitle className="mt-1 text-xl">{group.name}</CardTitle>
            </div>
            <Badge variant={group.role === "admin" ? "default" : "secondary"}>
              {roleLabel}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Price
              </p>
              <p className="font-mono mt-2 text-lg font-semibold tabular-nums">
                {group.billing.currentPrice} {group.billing.currency}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 text-lg font-semibold">{healthLabel}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm text-muted-foreground">
            <span className="font-mono flex items-center gap-2 text-sm">
              <Users className="size-4" />
              {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
            </span>
            <span className="font-mono flex items-center gap-2 text-sm tabular-nums">
              <CalendarDays className="size-4" />
              {group.nextBillingDate}
            </span>
          </div>
        </CardContent>

        <CardFooter className="justify-between">
          <span className="text-sm text-muted-foreground">
            {group.billing.mode.replace("_", " ")}
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            Open group
            <ArrowRight className="size-4" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
