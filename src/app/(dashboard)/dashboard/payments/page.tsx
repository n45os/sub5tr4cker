import { cookies } from "next/headers";
import Link from "next/link";
import { CreditCard, Receipt, Wallet } from "lucide-react";
import { PaymentStatusBadge } from "@/components/features/billing/payment-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getServerBaseUrl } from "@/lib/server-url";

interface PaymentRow {
  _id: string;
  periodId: string;
  periodLabel: string;
  periodStart: string;
  groupId: string;
  groupName: string;
  memberId: string;
  memberNickname: string;
  memberEmail: string;
  amount: number;
  currency: string;
  status: string;
  memberConfirmedAt: string | null;
  adminConfirmedAt: string | null;
}

interface PaymentsResponse {
  data: {
    payments: PaymentRow[];
    groups: Array<{ _id: string; name: string }>;
    pagination: { page: number; totalPages: number; total: number };
    summary: { totalCollected: number; totalPending: number; totalOverdue: number };
  };
}

async function getPayments(
  cookieHeader: string,
  params: { page?: string; status?: string; groupId?: string }
): Promise<PaymentsResponse["data"] | null> {
  const baseUrl = await getServerBaseUrl();
  const search = new URLSearchParams();
  if (params.page) search.set("page", params.page);
  if (params.status) search.set("status", params.status);
  if (params.groupId) search.set("groupId", params.groupId);
  search.set("limit", "20");
  const res = await fetch(`${baseUrl}/api/payments?${search.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as PaymentsResponse;
  return json.data ?? null;
}


function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    dateStyle: "short",
  });
}

function buildPaymentsQuery(params: {
  page: number;
  status?: string;
  groupId?: string;
}): string {
  const q: Record<string, string> = { page: String(params.page) };
  if (params.status) q.status = params.status;
  if (params.groupId) q.groupId = params.groupId;
  return new URLSearchParams(q).toString();
}

function PaymentsPagination({
  currentPage,
  totalPages,
  total,
  status,
  groupId,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  status?: string;
  groupId?: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <Link
          href={`/dashboard/payments?${buildPaymentsQuery({
            page: currentPage - 1,
            status,
            groupId,
          })}`}
        >
          <Button variant="outline" size="sm">
            Previous
          </Button>
        </Link>
      )}
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages} ({total} total)
      </span>
      {currentPage < totalPages && (
        <Link
          href={`/dashboard/payments?${buildPaymentsQuery({
            page: currentPage + 1,
            status,
            groupId,
          })}`}
        >
          <Button variant="outline" size="sm">
            Next
          </Button>
        </Link>
      )}
    </div>
  );
}

interface PaymentsPageProps {
  searchParams: Promise<{ page?: string; status?: string; groupId?: string }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const params = await searchParams;
  const data = await getPayments(cookieHeader, params);

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <p className="text-muted-foreground">Unable to load payments.</p>
      </div>
    );
  }

  const { payments, groups, pagination, summary } = data;
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;

  const summaryCurrencies = new Set(payments.map((p) => p.currency));
  const summaryCurrencyLabel =
    summaryCurrencies.size === 0
      ? "EUR"
      : summaryCurrencies.size === 1
        ? [...summaryCurrencies][0]
        : "mixed";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Wallet className="size-5" />
              {summary.totalCollected.toFixed(2)} {summaryCurrencyLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Confirmed payments
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CreditCard className="size-5" />
              {summary.totalPending.toFixed(2)} {summaryCurrencyLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Awaiting member or admin confirmation
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Receipt className="size-5" />
              {summary.totalOverdue.toFixed(2)} {summaryCurrencyLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Past due, follow up with members
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-4">
          <div>
            <CardTitle>Payment history</CardTitle>
            <CardDescription>
              All payment records across your groups. Filter by group or status.
            </CardDescription>
          </div>
          <form
            method="get"
            action="/dashboard/payments"
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="page" value="1" />
            <select
              name="groupId"
              defaultValue={params.groupId ?? ""}
              className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="member_confirmed">Member confirmed</option>
              <option value="confirmed">Confirmed</option>
              <option value="overdue">Overdue</option>
              <option value="waived">Waived</option>
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
              No payments match the current filters. Create a group and add
              billing periods to see payment records here.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Member confirmed</TableHead>
                    <TableHead>Admin confirmed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/groups/${row.groupId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.periodLabel}
                        </Link>
                      </TableCell>
                      <TableCell>{row.groupName}</TableCell>
                      <TableCell>
                        <span className="font-medium">{row.memberNickname}</span>
                        <span className="ml-1 text-muted-foreground">
                          ({row.memberEmail})
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.amount.toFixed(2)} {row.currency}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDate(row.memberConfirmedAt)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDate(row.adminConfirmedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <PaymentsPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  total={pagination.total}
                  status={params.status}
                  groupId={params.groupId}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
