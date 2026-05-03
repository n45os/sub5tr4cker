import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GroupCardActions } from "./group-card-actions";

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
  const isAdmin = group.role === "admin";
  const roleLabel = isAdmin ? "Owner" : "Member";
  const unpaidLabel =
    group.unpaidCount > 0
      ? `${group.unpaidCount} unpaid`
      : "All paid";
  const detailHref = `/dashboard/groups/${group._id}`;

  return (
    <Card className="group flex h-full flex-col border-border/70 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="gap-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {group.service.icon || "ST"} {group.service.name}
            </p>
            <CardTitle className="mt-1.5 text-xl">
              <Link
                href={detailHref}
                className="hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {group.name}
              </Link>
            </CardTitle>
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
              {unpaidLabel} · next {group.nextBillingDate}
            </p>
          </div>
          <Badge variant={isAdmin ? "default" : "secondary"}>{roleLabel}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-5">
        <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-mono text-base font-semibold tabular-nums">
            {group.billing.currentPrice} {group.billing.currency}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-4" />
            {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 px-5 py-4">
        <GroupCardActions
          groupId={group._id}
          unpaidCount={group.unpaidCount}
          canNotify={isAdmin}
        />
        <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
          <span>{group.billing.mode.replace("_", " ")}</span>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-2 font-medium text-foreground hover:underline"
          >
            Open
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
