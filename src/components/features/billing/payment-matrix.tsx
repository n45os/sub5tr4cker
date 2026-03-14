"use client";

import { useState, useCallback } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Minus,
  UserCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface PaymentCell {
  memberId: string;
  memberNickname: string;
  amount: number;
  status: string;
  memberConfirmedAt: string | null;
  adminConfirmedAt: string | null;
}

export interface PeriodRow {
  _id: string;
  periodLabel: string;
  totalPrice: number;
  payments: PaymentCell[];
  isFullyPaid: boolean;
}

export interface MemberColumn {
  _id: string;
  nickname: string;
  email: string;
}

interface PaymentMatrixProps {
  groupId: string;
  currency: string;
  periods: PeriodRow[];
  members: MemberColumn[];
  isAdmin: boolean;
  currentMemberId: string | null;
  onPeriodsChange?: (periods: PeriodRow[]) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getPaymentByMemberId(
  payments: PaymentCell[],
  memberId: string
): PaymentCell | undefined {
  return payments.find((p) => p.memberId === memberId);
}

function CellIcon({ status }: { status: string }) {
  switch (status) {
    case "confirmed":
      return (
        <Check className="size-4 shrink-0 text-status-confirmed" strokeWidth={2.5} />
      );
    case "member_confirmed":
      return (
        <UserCheck className="size-4 shrink-0 text-status-member-confirmed" />
      );
    case "overdue":
      return (
        <AlertTriangle className="size-4 shrink-0 text-status-overdue" />
      );
    case "waived":
      return <Minus className="size-4 shrink-0 text-muted-foreground" />;
    default:
      return null;
  }
}

function cellStatusClasses(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-status-confirmed/15 border-status-confirmed/40 text-status-confirmed ring-1 ring-status-confirmed/30";
    case "member_confirmed":
      return "bg-status-member-confirmed/15 border-status-member-confirmed/40 text-status-member-confirmed animate-pulse ring-1 ring-status-member-confirmed/30";
    case "pending":
      return "bg-status-pending/10 border-status-pending/30 text-status-pending";
    case "overdue":
      return "bg-status-overdue/15 border-status-overdue/40 text-status-overdue ring-1 ring-status-overdue/30";
    case "waived":
      return "bg-muted/50 border-border text-muted-foreground";
    default:
      return "bg-muted/30 border-border";
  }
}

export function PaymentMatrix({
  groupId,
  currency,
  periods: initialPeriods,
  members,
  isAdmin,
  currentMemberId,
  onPeriodsChange,
}: PaymentMatrixProps) {
  const [periods, setPeriods] = useState<PeriodRow[]>(initialPeriods);
  const [loadingCell, setLoadingCell] = useState<string | null>(null);
  const [errorCell, setErrorCell] = useState<string | null>(null);

  const updateCell = useCallback(
    (periodId: string, memberId: string, update: Partial<PaymentCell>) => {
      setPeriods((prev) => {
        const next = prev.map((p) => {
          if (p._id !== periodId) return p;
          const updatedPayments = p.payments.map((pay) =>
            pay.memberId === memberId ? { ...pay, ...update } : pay
          );
          const isFullyPaid = updatedPayments.every(
            (pay) => pay.status === "confirmed" || pay.status === "waived"
          );
          return {
            ...p,
            payments: updatedPayments,
            isFullyPaid,
          };
        });
        onPeriodsChange?.(next);
        return next;
      });
    },
    [onPeriodsChange]
  );

  const confirmApi = useCallback(
    async (periodId: string, memberId: string, action: "confirm" | "reject" | "waive") => {
      const key = `${periodId}-${memberId}`;
      setLoadingCell(key);
      setErrorCell(null);
      try {
        const res = await fetch(
          `/api/groups/${groupId}/billing/${periodId}/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId, action }),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          setErrorCell(key);
          setTimeout(() => setErrorCell(null), 2000);
          return;
        }
        const status =
          action === "confirm" ? "confirmed" : action === "waive" ? "waived" : "pending";
        const adminConfirmedAt =
          action === "confirm" || action === "waive" ? new Date().toISOString() : null;
        updateCell(periodId, memberId, {
          status,
          adminConfirmedAt,
        });
      } finally {
        setLoadingCell(null);
      }
    },
    [groupId, updateCell]
  );

  const selfConfirmApi = useCallback(
    async (periodId: string) => {
      if (!currentMemberId) return;
      const key = `${periodId}-${currentMemberId}`;
      setLoadingCell(key);
      setErrorCell(null);
      try {
        const res = await fetch(
          `/api/groups/${groupId}/billing/${periodId}/self-confirm`,
          { method: "POST" }
        );
        const json = await res.json();
        if (!res.ok) {
          setErrorCell(key);
          setTimeout(() => setErrorCell(null), 2000);
          return;
        }
        updateCell(periodId, currentMemberId, {
          status: "member_confirmed",
          memberConfirmedAt: new Date().toISOString(),
        });
      } finally {
        setLoadingCell(null);
      }
    },
    [groupId, currentMemberId, updateCell]
  );

  if (periods.length === 0) return null;

  const columnOrder = members.length
    ? members
    : periods[0]?.payments.map((p) => ({
        _id: p.memberId,
        nickname: p.memberNickname,
        email: "",
      })) ?? [];

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[400px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="sticky left-0 z-10 min-w-[120px] border-r bg-muted/50 px-4 py-3 text-left font-medium">
              Period
            </th>
            {columnOrder.map((mem) => (
              <th
                key={mem._id}
                className={cn(
                  "min-w-[100px] px-3 py-3 text-center font-medium",
                  currentMemberId === mem._id && "bg-primary/10"
                )}
              >
                <div className="truncate" title={mem.nickname}>
                  {mem.nickname}
                </div>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {(() => {
                    const pay = getPaymentByMemberId(
                      periods[0]?.payments ?? [],
                      mem._id
                    );
                    return pay ? `${pay.amount} ${currency}` : "—";
                  })()}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr
              key={period._id}
              className="border-b last:border-b-0 hover:bg-muted/20"
            >
              <td className="sticky left-0 z-10 border-r bg-card px-4 py-2">
                <div className="font-medium">{period.periodLabel}</div>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {period.totalPrice} {currency}
                </div>
                {period.isFullyPaid && (
                  <span className="mt-1 inline-block text-xs text-status-confirmed">
                    Fully paid
                  </span>
                )}
              </td>
              {columnOrder.map((mem) => {
                const payment = getPaymentByMemberId(period.payments, mem._id);
                const key = `${period._id}-${mem._id}`;
                const loading = loadingCell === key;
                const error = errorCell === key;
                const isCurrentUser = currentMemberId === mem._id;
                const canSelfConfirm =
                  isCurrentUser &&
                  !isAdmin &&
                  (payment?.status === "pending" || payment?.status === "overdue");
                const canAdminConfirm =
                  isAdmin &&
                  payment &&
                  (payment.status === "pending" ||
                    payment.status === "member_confirmed");
                const isConfirmedOrWaived =
                  payment?.status === "confirmed" || payment?.status === "waived";

                if (!payment) {
                  return (
                    <td key={mem._id} className="px-3 py-2 text-center">
                      <span className="text-muted-foreground">—</span>
                    </td>
                  );
                }

                const handleMemberClick = () => {
                  if (loading) return;
                  if (canSelfConfirm) selfConfirmApi(period._id);
                };

                const cellButton = (
                  <button
                    type="button"
                    onClick={isAdmin ? undefined : handleMemberClick}
                    disabled={
                      loading ||
                      (!isAdmin && !canSelfConfirm) ||
                      (isAdmin && !canAdminConfirm && !isConfirmedOrWaived)
                    }
                    className={cn(
                      "mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition-all hover:opacity-90 disabled:cursor-default disabled:opacity-70",
                      cellStatusClasses(payment.status),
                      (canAdminConfirm || canSelfConfirm) &&
                        "cursor-pointer hover:ring-2 hover:ring-primary/50",
                      isAdmin && isConfirmedOrWaived && "cursor-pointer hover:opacity-80",
                      error && "border-destructive bg-destructive/10 ring-2 ring-destructive/50"
                    )}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CellIcon status={payment.status} />
                    )}
                    {!loading && !payment.status && (
                      <span className="text-xs">○</span>
                    )}
                  </button>
                );

                const tooltipContent = (
                  <div className="space-y-1 text-left">
                    <p className="font-medium">
                      {payment.memberNickname} · {payment.amount} {currency}
                    </p>
                    <p className="text-muted-foreground capitalize">
                      {payment.status.replace("_", " ")}
                    </p>
                    {payment.memberConfirmedAt && (
                      <p className="text-xs">
                        Member confirmed:{" "}
                        {formatDate(payment.memberConfirmedAt)}
                      </p>
                    )}
                    {payment.adminConfirmedAt && (
                      <p className="text-xs">
                        Admin confirmed:{" "}
                        {formatDate(payment.adminConfirmedAt)}
                      </p>
                    )}
                    {canSelfConfirm && (
                      <p className="text-xs text-primary">
                        Click to mark as &quot;I&apos;ve paid&quot;
                      </p>
                    )}
                    {isAdmin && (canAdminConfirm || isConfirmedOrWaived) && (
                      <p className="text-xs text-muted-foreground">
                        Click menu to confirm, reject, or waive
                      </p>
                    )}
                  </div>
                );

                const interactiveCell =
                  isAdmin && (canAdminConfirm || isConfirmedOrWaived) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          "mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition-all hover:opacity-90 disabled:cursor-default disabled:opacity-70",
                          cellStatusClasses(payment.status),
                          (canAdminConfirm || canSelfConfirm) &&
                            "cursor-pointer hover:ring-2 hover:ring-primary/50",
                          isAdmin && isConfirmedOrWaived && "cursor-pointer hover:opacity-80",
                          error &&
                            "border-destructive bg-destructive/10 ring-2 ring-destructive/50"
                        )}
                      >
                        {loading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CellIcon status={payment.status} />
                        )}
                        {!loading && !payment.status && (
                          <span className="text-xs">○</span>
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        <DropdownMenuItem
                          onClick={() =>
                            confirmApi(period._id, mem._id, "confirm")
                          }
                          disabled={loading}
                        >
                          <Check className="size-4" />
                          Confirm paid
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            confirmApi(period._id, mem._id, "reject")
                          }
                          disabled={loading}
                          variant="destructive"
                        >
                          Reject
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            confirmApi(period._id, mem._id, "waive")
                          }
                          disabled={loading}
                        >
                          <Minus className="size-4" />
                          Waive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger>{cellButton}</TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {tooltipContent}
                      </TooltipContent>
                    </Tooltip>
                  );

                return (
                  <td key={mem._id} className="px-3 py-2">
                    {interactiveCell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
