import Link from "next/link";
import { cookies } from "next/headers";
import { GroupCard } from "@/components/features/groups/GroupCard";
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

export default async function GroupsPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const groups = await getGroups(cookieHeader);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-1">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div>
            <CardTitle className="text-xl">Your groups</CardTitle>
            <CardDescription className="mt-1.5">
              Review pricing, due dates, and unpaid balances at a glance.
            </CardDescription>
          </div>
          <Link href="/dashboard/groups/new">
            <Badge variant="accent" className="px-3 py-1 text-sm">
              New group
            </Badge>
          </Link>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-4">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-8 py-16 text-center">
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
            <ul className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
              {groups.map((group) => (
                <li key={group._id}>
                  <GroupCard group={group} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
