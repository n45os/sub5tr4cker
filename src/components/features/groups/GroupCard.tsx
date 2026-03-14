import Link from "next/link";

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
  return (
    <Link
      href={`/dashboard/groups/${group._id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between">
        <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          {group.name}
        </span>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {group.role}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {group.service.icon} {group.service.name}
      </p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {group.memberCount} member{group.memberCount !== 1 ? "s" : ""} ·{" "}
        {group.billing.currentPrice} {group.billing.currency}
        {group.unpaidCount > 0 && (
          <span className="ml-1 text-amber-600 dark:text-amber-400">
            · {group.unpaidCount} unpaid
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        Next billing: {group.nextBillingDate}
      </p>
    </Link>
  );
}
