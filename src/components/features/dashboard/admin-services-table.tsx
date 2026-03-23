import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DeleteGroupButton } from "@/components/features/groups/delete-group-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface AdminServiceRow {
  _id: string;
  name: string;
  service: { name: string; icon: string | null };
  memberCount: number;
  billing: { currentPrice: number; currency: string; mode: string };
  nextBillingDate: string;
  unpaidCount: number;
}

export function AdminServicesTable({ groups }: { groups: AdminServiceRow[] }) {
  if (groups.length === 0) {
    return null;
  }

  const currencies = new Set(groups.map((g) => g.billing.currency));
  const sameCurrency = currencies.size <= 1;
  const totalAdminSpend = sameCurrency
    ? groups.reduce((sum, g) => sum + g.billing.currentPrice, 0)
    : null;
  const primaryCurrency = groups[0]?.billing.currency ?? "EUR";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-2 w-fit">
            Admin
          </Badge>
          <CardTitle>Subscriptions you pay for</CardTitle>
          <CardDescription>
            Groups where you are the owner
            {sameCurrency && totalAdminSpend !== null ? (
              <>
                {" "}
                — about{" "}
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {totalAdminSpend.toFixed(2)} {primaryCurrency}
                </span>{" "}
                per cycle across these subscriptions
              </>
            ) : (
              <> — pricing is per row when currencies differ</>
            )}
            .
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">Service</TableHead>
              <TableHead className="min-w-[160px]">Group</TableHead>
              <TableHead className="text-right">Price / cycle</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Next cycle</TableHead>
              <TableHead className="text-right">Attention</TableHead>
              <TableHead className="text-right w-[1%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const attention =
                group.unpaidCount > 0
                  ? `${group.unpaidCount} unpaid`
                  : "—";
              return (
                <TableRow key={group._id}>
                  <TableCell className="font-medium">
                    <span className="text-muted-foreground">
                      {group.service.icon || "·"}{" "}
                    </span>
                    {group.service.name}
                  </TableCell>
                  <TableCell>{group.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {group.billing.currentPrice} {group.billing.currency}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {group.memberCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                    {group.nextBillingDate}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right text-sm",
                      group.unpaidCount > 0
                        ? "font-medium text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {attention}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Link
                        href={`/dashboard/groups/${group._id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "xs" }),
                          "gap-1"
                        )}
                      >
                        Open
                        <ChevronRight className="size-3" />
                      </Link>
                      <DeleteGroupButton
                        groupId={group._id}
                        groupName={group.name}
                        size="xs"
                        label="Delete"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
