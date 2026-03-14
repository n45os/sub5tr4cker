import Link from "next/link";
import { cookies } from "next/headers";
import { GroupCard } from "@/components/features/groups/GroupCard";

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
  const base = process.env.APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/groups`, {
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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Your groups
        </h1>
        <Link
          href="/dashboard/groups/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New group
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">
            You don’t have any subscription groups yet.
          </p>
          <Link
            href="/dashboard/groups/new"
            className="mt-4 inline-block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Create your first group
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <li key={g._id}>
              <GroupCard group={g} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
