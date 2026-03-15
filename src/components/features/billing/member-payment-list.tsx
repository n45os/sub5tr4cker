"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Loader2,
  Minus,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Payment {
  memberId: string;
  memberNickname: string;
  amount: number;
  status: string;
  memberConfirmedAt: string | null;
  adminConfirmedAt: string | null;
}

interface Period {
  _id: string;
  periodStart: string;
  periodEnd?: string;
  periodLabel: string;
  totalPrice: number;
  payments: Payment[];
  isFullyPaid: boolean;
}

interface MemberPaymentListProps {
  groupId: string;
  currency: string;
  periods: Period[];
  currentMemberId: string | null;
  memberToken?: string;
}

function statusIcon(status: string) {
  switch (status) {
    case "confirmed":
      return <CheckCircle className="size-5 text-green-600" />;
    case "member_confirmed":
      return <UserCheck className="size-5 text-blue-600" />;
    case "overdue":
      return <AlertTriangle className="size-5 text-destructive" />;
    case "waived":
      return <Minus className="size-5 text-muted-foreground" />;
    case "pending":
      return <Clock className="size-5 text-muted-foreground/60" />;
    default:
      return <span className="size-4 rounded-full border-2 border-muted-foreground/30" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "member_confirmed":
      return "Awaiting admin";
    case "overdue":
      return "Overdue";
    case "waived":
      return "Waived";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "member_confirmed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "overdue":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "waived":
      return "bg-muted text-muted-foreground";
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MemberPaymentList({
  groupId,
  currency,
  periods: initialPeriods,
  currentMemberId,
  memberToken,
}: MemberPaymentListProps) {
  const [periods, setPeriods] = useState(initialPeriods);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setPeriods(initialPeriods);
  }, [initialPeriods]);

  const getMyPayment = useCallback(
    (period: Period) => {
      if (!currentMemberId) return null;
      return period.payments.find((p) => p.memberId === currentMemberId) ?? null;
    },
    [currentMemberId]
  );

  const canSelect = useCallback(
    (period: Period) => {
      const pay = getMyPayment(period);
      return pay?.status === "pending" || pay?.status === "overdue";
    },
    [getMyPayment]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmError(null);
  };

  const selectedTotal = Array.from(selectedIds).reduce((sum, id) => {
    const period = periods.find((p) => p._id === id);
    const pay = period ? getMyPayment(period) : null;
    return sum + (pay?.amount ?? 0);
  }, 0);

  const confirmPayments = useCallback(async () => {
    if (!currentMemberId || selectedIds.size === 0) return;
    setConfirming(true);
    setConfirmError(null);
    const ids = Array.from(selectedIds);
    const failed: string[] = [];

    for (const periodId of ids) {
      setLoadingId(periodId);
      try {
        const res = await fetch(
          `/api/groups/${groupId}/billing/${periodId}/self-confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(memberToken ? { memberToken } : {}),
          }
        );
        const json = await res.json();
        if (res.ok) {
          setPeriods((prev) =>
            prev.map((p) => {
              if (p._id !== periodId) return p;
              return {
                ...p,
                payments: p.payments.map((pay) =>
                  pay.memberId === currentMemberId
                    ? { ...pay, status: "member_confirmed", memberConfirmedAt: new Date().toISOString() }
                    : pay
                ),
              };
            })
          );
        } else {
          failed.push(periodId);
          setConfirmError(json?.error?.message || "Could not confirm payment");
        }
      } catch {
        failed.push(periodId);
        setConfirmError("Something went wrong");
      } finally {
        setLoadingId(null);
      }
    }

    if (failed.length === 0) {
      setSelectedIds(new Set());
      setConfirmOpen(false);
    } else {
      setSelectedIds(new Set(failed));
    }
    setConfirming(false);
  }, [groupId, currentMemberId, memberToken, selectedIds]);

  return (
    <div className="flex flex-col">
      <div className="max-h-112 overflow-y-auto divide-y rounded-lg border">
        {periods.map((period) => {
          const pay = getMyPayment(period);
          if (!pay) return null;
          const selectable = canSelect(period);
          const selected = selectedIds.has(period._id);
          const isLoading = loadingId === period._id;

          return (
            <button
              key={period._id}
              type="button"
              disabled={!selectable || isLoading}
              onClick={() => selectable && toggleSelect(period._id)}
              className={cn(
                "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors",
                selectable && "hover:bg-muted/50 cursor-pointer",
                selected && "bg-primary/10",
                !selectable && "cursor-default"
              )}
            >
              {/* checkbox for unpaid, status icon for others */}
              <div className="shrink-0">
                {isLoading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : selectable ? (
                  <div
                    className={cn(
                      "flex size-5 items-center justify-center rounded-md border transition-all duration-150",
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-input bg-background hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    {selected && (
                      <Check className="size-3 text-primary-foreground" strokeWidth={2.5} />
                    )}
                  </div>
                ) : (
                  statusIcon(pay.status)
                )}
              </div>

              {/* period info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{period.periodLabel}</span>
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    statusBadgeClasses(pay.status)
                  )}>
                    {statusLabel(pay.status)}
                  </span>
                </div>
                {period.periodStart && period.periodEnd && (
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(period.periodStart)} – {formatDateShort(period.periodEnd)}
                  </p>
                )}
                {(pay.memberConfirmedAt || pay.adminConfirmedAt) && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {pay.memberConfirmedAt && `You: ${formatDateShort(pay.memberConfirmedAt)}`}
                    {pay.memberConfirmedAt && pay.adminConfirmedAt && " · "}
                    {pay.adminConfirmedAt && `Admin: ${formatDateShort(pay.adminConfirmedAt)}`}
                  </p>
                )}
              </div>

              {/* amount */}
              <div className="shrink-0 text-right">
                <span className="font-mono text-sm font-medium tabular-nums">
                  {pay.amount} {currency}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* confirm bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3 mt-2 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} period{selectedIds.size !== 1 ? "s" : ""}{" · "}
            <span className="font-mono font-medium text-foreground">
              {selectedTotal.toFixed(2)} {currency}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedIds(new Set());
                setConfirmError(null);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmError(null);
                setConfirmOpen(true);
              }}
            >
              <Check className="mr-2 size-4" />
              I&apos;ve paid
            </Button>
          </div>
        </div>
      )}

      {/* confirm dialog */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setConfirmError(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm payment?</DialogTitle>
            <DialogDescription>
              You&apos;re marking {selectedIds.size} period{selectedIds.size !== 1 ? "s" : ""} as
              paid for a total of{" "}
              <span className="font-mono font-semibold text-foreground">
                {selectedTotal.toFixed(2)} {currency}
              </span>.
              The admin will verify your payment.
            </DialogDescription>
          </DialogHeader>
          {confirmError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {confirmError}
            </div>
          )}
          <div className="space-y-2 py-2">
            {Array.from(selectedIds).map((id) => {
              const period = periods.find((p) => p._id === id);
              const pay = period ? getMyPayment(period) : null;
              if (!period || !pay) return null;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{period.periodLabel}</span>
                  <span className="font-mono tabular-nums">
                    {pay.amount} {currency}
                  </span>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={confirming}
            >
              Cancel
            </Button>
            <Button onClick={confirmPayments} disabled={confirming}>
              {confirming && <Loader2 className="mr-2 size-4 animate-spin" />}
              Yes, I&apos;ve paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
