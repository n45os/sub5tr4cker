import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

interface GroupDetail {
  _id: string;
  name: string;
  description: string | null;
  service: { name: string; icon: string | null; url: string | null };
  billing: Record<string, unknown>;
  payment: Record<string, unknown>;
  role: string;
  members: Array<{
    _id: string;
    email: string;
    nickname: string;
    role: string;
    customAmount: number | null;
  }>;
}

interface BillingPeriodItem {
  _id: string;
  periodLabel: string;
  totalPrice: number;
  payments: Array<{
    memberId: string;
    memberNickname: string;
    amount: number;
    status: string;
  }>;
  isFullyPaid: boolean;
}

async function getGroup(
  groupId: string,
  cookieHeader: string
): Promise<GroupDetail | null> {
  const base = process.env.APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/groups/${groupId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

async function getBillingPeriods(
  groupId: string,
  cookieHeader: string
): Promise<BillingPeriodItem[]> {
  const base = process.env.APP_URL || "http://localhost:3000";
  const res = await fetch(
    `${base}/api/groups/${groupId}/billing?limit=3`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.data?.periods ?? [];
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const [group, periods] = await Promise.all([
    getGroup(groupId, cookieHeader),
    getBillingPeriods(groupId, cookieHeader),
  ]);

  if (!group) notFound();

  const currentPeriod = periods[0];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard"
        className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to groups
      </Link>
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {group.name}
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {group.service.icon} {group.service.name}
          </p>
          <span className="mt-2 inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {group.role}
          </span>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Members
        </h2>
        <ul className="mt-2 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {group.members.map((m) => (
            <li
              key={m._id}
              className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {m.nickname}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {m.email}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Billing periods
        </h2>
        {!currentPeriod ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No billing periods yet. They are created automatically on the cycle
            day, or you can create one manually for variable billing.
          </p>
        ) : (
          <div className="mt-2 space-y-4">
            {periods.map((p) => (
              <div
                key={p._id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {p.periodLabel}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {p.totalPrice} {(group.billing.currency as string) || "EUR"}{" "}
                    {p.isFullyPaid && "· Fully paid"}
                  </span>
                </div>
                <ul className="mt-3 space-y-1">
                  {p.payments.map((pay) => (
                    <li
                      key={pay.memberId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {pay.memberNickname}
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {pay.amount} ·{" "}
                        <span
                          className={
                            pay.status === "confirmed" || pay.status === "waived"
                              ? "text-green-600 dark:text-green-400"
                              : pay.status === "member_confirmed"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-zinc-500 dark:text-zinc-400"
                          }
                        >
                          {pay.status.replace("_", " ")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
