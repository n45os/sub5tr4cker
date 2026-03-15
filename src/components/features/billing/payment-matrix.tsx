"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  Minus,
  MoreVertical,
  Pencil,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getPeriodDisplayState } from "@/lib/billing/period-display";
import { cn } from "@/lib/utils";

export interface PaymentCell {
  memberId: string;
  memberNickname: string;
  amount: number;
  adjustedAmount?: number | null;
  adjustmentReason?: string | null;
  status: string;
  memberConfirmedAt: string | null;
  adminConfirmedAt: string | null;
}

export interface PeriodRow {
  _id: string;
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  totalPrice: number;
  priceNote?: string | null;
  payments: PaymentCell[];
  isFullyPaid: boolean;
}

export interface MemberColumn {
  _id: string;
  nickname: string;
  email: string;
}

function effectiveAmount(payment: PaymentCell): number {
  return payment.adjustedAmount ?? payment.amount;
}

interface PaymentMatrixProps {
  groupId: string;
  currency: string;
  periods: PeriodRow[];
  members: MemberColumn[];
  isAdmin: boolean;
  currentMemberId: string | null;
  memberToken?: string;
  paymentPlatform?: string | null;
  paymentLink?: string | null;
  paymentInstructions?: string | null;
  onPeriodsChange?: (periods: PeriodRow[]) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatDateRange(startIso: string | undefined, endIso: string | undefined): string | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatPaymentPlatform(platform?: string | null) {
  if (!platform) return "payment link";
  return platform.replace(/_/g, " ");
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
    case "pending":
      return <span className="size-3 rounded-full border-2 border-current opacity-40" />;
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
  memberToken,
  paymentPlatform,
  paymentLink,
  paymentInstructions,
  onPeriodsChange,
}: PaymentMatrixProps) {
  const [periods, setPeriods] = useState<PeriodRow[]>(initialPeriods);
  const [loadingCell, setLoadingCell] = useState<string | null>(null);
  const [errorCell, setErrorCell] = useState<string | null>(null);

  useEffect(() => {
    setPeriods(initialPeriods);
  }, [initialPeriods]);

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

  // member multi-select + confirmation flow
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const togglePeriodSelection = useCallback(
    (periodId: string) => {
      setConfirmError(null);
      setSelectedPeriods((prev) => {
        const next = new Set(prev);
        if (next.has(periodId)) {
          next.delete(periodId);
        } else {
          next.add(periodId);
        }
        return next;
      });
    },
    []
  );

  const selectedTotal = Array.from(selectedPeriods).reduce((sum, periodId) => {
    const period = periods.find((p) => p._id === periodId);
    if (!period || !currentMemberId) return sum;
    const payment = getPaymentByMemberId(period.payments, currentMemberId);
    return sum + (payment ? effectiveAmount(payment) : 0);
  }, 0);

  const confirmSelectedPayments = useCallback(async () => {
    if (!currentMemberId || selectedPeriods.size === 0) return;
    setConfirmingPayment(true);
    setConfirmError(null);
    const periodIds = Array.from(selectedPeriods);
    const failedPeriodIds: string[] = [];
    for (const periodId of periodIds) {
      const key = `${periodId}-${currentMemberId}`;
      setLoadingCell(key);
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
          updateCell(periodId, currentMemberId, {
            status: "member_confirmed",
            memberConfirmedAt: new Date().toISOString(),
          });
        } else {
          failedPeriodIds.push(periodId);
          setErrorCell(key);
          setConfirmError(
            json?.error?.message || "Could not confirm the selected payment"
          );
          setTimeout(() => setErrorCell(null), 2500);
        }
      } catch {
        failedPeriodIds.push(periodId);
        setErrorCell(key);
        setConfirmError("Something went wrong while confirming the selected payment");
        setTimeout(() => setErrorCell(null), 2500);
      } finally {
        setLoadingCell(null);
      }
    }

    if (failedPeriodIds.length === 0) {
      setSelectedPeriods(new Set());
      setConfirmDialogOpen(false);
    } else {
      setSelectedPeriods(new Set(failedPeriodIds));
    }

    setConfirmingPayment(false);
  }, [groupId, currentMemberId, memberToken, selectedPeriods, updateCell]);

  // adjustment dialog state
  const [adjustDialog, setAdjustDialog] = useState<{
    periodId: string;
    memberId: string;
    memberNickname: string;
    currentAmount: number;
    adjustedAmount: string;
    reason: string;
  } | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  const openAdjustDialog = useCallback(
    (periodId: string, payment: PaymentCell) => {
      setAdjustDialog({
        periodId,
        memberId: payment.memberId,
        memberNickname: payment.memberNickname,
        currentAmount: payment.amount,
        adjustedAmount: payment.adjustedAmount ? String(payment.adjustedAmount) : "",
        reason: payment.adjustmentReason || "",
      });
    },
    [],
  );

  const saveAdjustment = useCallback(async () => {
    if (!adjustDialog) return;
    setAdjustSaving(true);
    try {
      const adjustedAmount = adjustDialog.adjustedAmount
        ? parseFloat(adjustDialog.adjustedAmount)
        : null;
      const res = await fetch(
        `/api/groups/${groupId}/billing/${adjustDialog.periodId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payments: [
              {
                memberId: adjustDialog.memberId,
                adjustedAmount,
                adjustmentReason: adjustDialog.reason || null,
              },
            ],
          }),
        },
      );
      if (res.ok) {
        updateCell(adjustDialog.periodId, adjustDialog.memberId, {
          adjustedAmount,
          adjustmentReason: adjustDialog.reason || null,
        });
        setAdjustDialog(null);
      }
    } finally {
      setAdjustSaving(false);
    }
  }, [adjustDialog, groupId, updateCell]);

  // edit period dialog (admin)
  const [editPeriodDialog, setEditPeriodDialog] = useState<{
    periodId: string;
    periodLabel: string;
    totalPrice: string;
    priceNote: string;
  } | null>(null);
  const [editPeriodSaving, setEditPeriodSaving] = useState(false);
  const [editPeriodDeleting, setEditPeriodDeleting] = useState(false);
  const [editPeriodDeleteConfirm, setEditPeriodDeleteConfirm] = useState(false);

  const deletePeriod = useCallback(async () => {
    if (!editPeriodDialog) return;
    setEditPeriodDeleting(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/billing/${editPeriodDialog.periodId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setPeriods((prev) => prev.filter((p) => p._id !== editPeriodDialog.periodId));
        setEditPeriodDialog(null);
        setEditPeriodDeleteConfirm(false);
      }
    } finally {
      setEditPeriodDeleting(false);
    }
  }, [editPeriodDialog, groupId]);

  const saveEditPeriod = useCallback(async () => {
    if (!editPeriodDialog) return;
    const totalPrice = parseFloat(editPeriodDialog.totalPrice);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) return;
    setEditPeriodSaving(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/billing/${editPeriodDialog.periodId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalPrice,
            priceNote: editPeriodDialog.priceNote.trim() || null,
          }),
        },
      );
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        setPeriods((prev) =>
          prev.map((p) =>
            p._id === editPeriodDialog.periodId
              ? {
                  ...p,
                  totalPrice: data.totalPrice,
                  priceNote: data.priceNote ?? null,
                  isFullyPaid: data.isFullyPaid,
                }
              : p,
          ),
        );
        setEditPeriodDialog(null);
      }
    } finally {
      setEditPeriodSaving(false);
    }
  }, [editPeriodDialog, groupId]);

  // advance periods state
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceMonths, setAdvanceMonths] = useState("3");
  const [advanceLoading, setAdvanceLoading] = useState(false);

  const router = useRouter();

  const generateAdvancePeriods = useCallback(async () => {
    const months = parseInt(advanceMonths, 10);
    if (!months || months < 1 || months > 12) return;
    setAdvanceLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/billing/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthsAhead: months }),
      });
      if (res.ok) {
        setAdvanceOpen(false);
        router.refresh();
      }
    } finally {
      setAdvanceLoading(false);
    }
  }, [groupId, advanceMonths, router]);

  // backfill (previous) periods state
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillMonths, setBackfillMonths] = useState("3");
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  const generateBackfillPeriods = useCallback(async () => {
    const months = parseInt(backfillMonths, 10);
    if (!months || months < 1 || months > 12) return;
    setBackfillLoading(true);
    setBackfillError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/billing/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthsBack: months }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const created = json?.data?.created ?? 0;
        if (created > 0) {
          setBackfillOpen(false);
          router.refresh();
        } else {
          setBackfillError(
            "No new periods were created. They may already exist for those months."
          );
        }
      } else {
        setBackfillError(json?.error?.message ?? "Failed to create previous periods");
      }
    } catch {
      setBackfillError("Something went wrong");
    } finally {
      setBackfillLoading(false);
    }
  }, [groupId, backfillMonths, router]);

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
      <table className="w-max min-w-[360px] border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="sticky left-0 z-10 min-w-[110px] border-r bg-muted/50 px-3 py-2.5 text-left font-medium">
              Period
            </th>
            {columnOrder.map((mem) => (
              <th
                key={mem._id}
                className={cn(
                  "min-w-[80px] px-3 py-2.5 text-center font-medium",
                  currentMemberId === mem._id && "bg-primary/10"
                )}
              >
                <div className="truncate" title={mem.nickname}>
                  {mem.nickname}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => {
            const { isCurrent, isPast } = getPeriodDisplayState(period);
            return (
            <tr
              key={period._id}
              className={cn(
                "border-b last:border-b-0 hover:bg-muted/20",
                isCurrent && "bg-primary/10 ring-inset ring-l-2 ring-primary",
                isPast && "bg-muted/25"
              )}
            >
              <td
                className={cn(
                  "sticky left-0 z-10 border-r px-3 py-2",
                  isCurrent ? "bg-primary/10" : isPast ? "bg-muted/25" : "bg-card"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{period.periodLabel}</span>
                  {period.priceNote && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="size-3.5 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs text-xs">
                        {period.priceNote}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon-xs" }),
                          "shrink-0"
                        )}
                        aria-label="Edit period"
                      >
                        <MoreVertical className="size-3" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() =>
                            setEditPeriodDialog({
                              periodId: period._id,
                              periodLabel: period.periodLabel,
                              totalPrice: String(period.totalPrice),
                              priceNote: period.priceNote ?? "",
                            })
                          }
                        >
                          <Pencil className="mr-2 size-3.5" />
                          Edit period
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {period.totalPrice} {currency}
                </div>
                {period.periodStart && period.periodEnd && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {formatDateRange(period.periodStart, period.periodEnd)}
                  </div>
                )}
                {period.isFullyPaid && (
                  <span className="mt-1 inline-block text-[10px] text-status-confirmed">
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

                const isSelected = canSelfConfirm && selectedPeriods.has(period._id);
                const handleMemberClick = () => {
                  if (loading) return;
                  if (canSelfConfirm) togglePeriodSelection(period._id);
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
                      "mx-auto flex h-7 w-7 items-center justify-center rounded-md border transition-all hover:opacity-90 disabled:cursor-default disabled:opacity-70",
                      isSelected
                        ? "bg-primary/20 border-primary ring-2 ring-primary/50"
                        : cellStatusClasses(payment.status),
                      (canAdminConfirm || canSelfConfirm) &&
                        "cursor-pointer hover:ring-2 hover:ring-primary/50",
                      isAdmin && isConfirmedOrWaived && "cursor-pointer hover:opacity-80",
                      error && "border-destructive bg-destructive/10 ring-2 ring-destructive/50"
                    )}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isSelected ? (
                      <Check className="size-4 text-primary" strokeWidth={2.5} />
                    ) : (
                      <CellIcon status={payment.status} />
                    )}
                  </button>
                );

                const tooltipContent = (
                  <div className="space-y-1 text-left">
                    <p className="font-medium">
                      {payment.memberNickname} · {effectiveAmount(payment)} {currency}
                    </p>
                    {payment.adjustedAmount != null && (
                      <p className="text-xs text-amber-600">
                        Adjusted from {payment.amount} {currency}
                        {payment.adjustmentReason && ` — ${payment.adjustmentReason}`}
                      </p>
                    )}
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
                        {isSelected
                          ? "Selected — click again to deselect"
                          : "Click to select, then start payment"}
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
                          "mx-auto flex h-7 w-7 items-center justify-center rounded-md border transition-all hover:opacity-90 disabled:cursor-default disabled:opacity-70",
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openAdjustDialog(period._id, payment)}
                        >
                          <Pencil className="size-4" />
                          Adjust amount
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger render={cellButton} />
                      <TooltipContent side="top" className="max-w-xs">
                        {tooltipContent}
                      </TooltipContent>
                    </Tooltip>
                  );

                const hasConfirmedDates =
                  (payment.status === "confirmed" || payment.status === "waived") &&
                  (payment.memberConfirmedAt || payment.adminConfirmedAt);

                return (
                  <td key={mem._id} className="px-3 py-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {effectiveAmount(payment)} {currency}
                      </div>
                      <div className="relative inline-flex">
                        {interactiveCell}
                        {payment.adjustedAmount != null && (
                          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500" title="Amount adjusted" />
                        )}
                      </div>
                      {hasConfirmedDates && (
                        <div className="text-[10px] text-muted-foreground text-center leading-snug space-y-0.5">
                          {payment.memberConfirmedAt && (
                            <div>Member: {formatDateShort(payment.memberConfirmedAt)}</div>
                          )}
                          {payment.adminConfirmedAt && (
                            <div>Admin: {formatDateShort(payment.adminConfirmedAt)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>

      {/* member confirm bar */}
      {!isAdmin && selectedPeriods.size > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {selectedPeriods.size} period{selectedPeriods.size !== 1 ? "s" : ""} selected
            {" · "}
            <span className="font-mono font-medium text-foreground">
              {selectedTotal.toFixed(2)} {currency}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedPeriods(new Set());
                setConfirmError(null);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmError(null);
                setConfirmDialogOpen(true);
              }}
            >
              <Check className="mr-2 size-4" />
              Pay selected
            </Button>
          </div>
        </div>
      )}

      {/* member confirm dialog */}
      <Dialog
        open={confirmDialogOpen}
        onOpenChange={(open) => {
          setConfirmDialogOpen(open);
          if (!open) setConfirmError(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay for selected periods</DialogTitle>
            <DialogDescription>
              You&apos;re about to pay for {selectedPeriods.size} period{selectedPeriods.size !== 1 ? "s" : ""} totaling{" "}
              <span className="font-mono font-semibold text-foreground">
                {selectedTotal.toFixed(2)} {currency}
              </span>.
              Complete the payment using the details below, then come back and press
              &quot;I&apos;ve paid&quot; so the admin can verify it.
            </DialogDescription>
          </DialogHeader>
          {confirmError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {confirmError}
            </div>
          )}
          <div className="space-y-2 py-2">
            {Array.from(selectedPeriods).map((periodId) => {
              const period = periods.find((p) => p._id === periodId);
              if (!period || !currentMemberId) return null;
              const payment = getPaymentByMemberId(period.payments, currentMemberId);
              if (!payment) return null;
              return (
                <div
                  key={periodId}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{period.periodLabel}</span>
                  <span className="font-mono tabular-nums">
                    {effectiveAmount(payment)} {currency}
                  </span>
                </div>
              );
            })}
          </div>
          {(paymentLink || paymentInstructions || paymentPlatform) && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Payment method
                </p>
                <p className="text-sm font-medium capitalize">
                  {formatPaymentPlatform(paymentPlatform)}
                </p>
              </div>
              {paymentInstructions && (
                <p className="text-sm text-muted-foreground">{paymentInstructions}</p>
              )}
              {paymentLink && (
                <Link
                  href={paymentLink}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Open payment link
                </Link>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={confirmingPayment}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSelectedPayments}
              disabled={confirmingPayment}
            >
              {confirmingPayment && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Yes, I&apos;ve paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* create periods: two buttons + advance + backfill dialogs */}
      {isAdmin && (
        <>
          <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdvanceOpen(true)}
            >
              Create upcoming periods
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBackfillError(null);
                setBackfillOpen(true);
              }}
            >
              Create previous periods
            </Button>
          </div>
          <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Generate future periods</DialogTitle>
                <DialogDescription>
                  Choose how many months ahead to create. Members can mark payment for
                  future periods if they want to prepay.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="advanceMonths">How many months ahead? (1–12)</Label>
                  <Input
                    id="advanceMonths"
                    type="number"
                    min={1}
                    max={12}
                    value={advanceMonths}
                    onChange={(e) => setAdvanceMonths(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdvanceOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={generateAdvancePeriods} disabled={advanceLoading}>
                  {advanceLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={backfillOpen}
            onOpenChange={(open) => {
              setBackfillOpen(open);
              if (!open) setBackfillError(null);
            }}
          >
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Create past periods</DialogTitle>
                <DialogDescription>
                  Create billing periods for past months so you can record or import
                  history. Periods are added backward from your earliest existing period.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {backfillError && (
                  <p
                    className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    role="alert"
                  >
                    <AlertTriangle className="size-4 shrink-0" />
                    {backfillError}
                  </p>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="backfillMonths">How many months back? (1–12)</Label>
                  <Input
                    id="backfillMonths"
                    type="number"
                    min={1}
                    max={12}
                    value={backfillMonths}
                    onChange={(e) => setBackfillMonths(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBackfillOpen(false);
                    setBackfillError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={generateBackfillPeriods} disabled={backfillLoading}>
                  {backfillLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* edit period dialog */}
      <Dialog
        open={!!editPeriodDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditPeriodDialog(null);
            setEditPeriodDeleteConfirm(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editPeriodDeleteConfirm ? "Delete period?" : "Edit period"}
            </DialogTitle>
            <DialogDescription>
              {editPeriodDeleteConfirm
                ? `Remove ${editPeriodDialog?.periodLabel} and all its payment records. This cannot be undone.`
                : `Update total price or add a note for ${editPeriodDialog?.periodLabel}. Member amounts stay as-is unless you adjust them per cell.`}
            </DialogDescription>
          </DialogHeader>
          {editPeriodDeleteConfirm ? (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setEditPeriodDeleteConfirm(false)}
                disabled={editPeriodDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={deletePeriod}
                disabled={editPeriodDeleting}
              >
                {editPeriodDeleting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            </DialogFooter>
          ) : (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-totalPrice">Total price ({currency})</Label>
                  <Input
                    id="edit-totalPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPeriodDialog?.totalPrice ?? ""}
                    onChange={(e) =>
                      setEditPeriodDialog((prev) =>
                        prev ? { ...prev, totalPrice: e.target.value } : null,
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-priceNote">Price note (optional)</Label>
                  <Textarea
                    id="edit-priceNote"
                    placeholder="e.g. prorated, price increase"
                    rows={2}
                    value={editPeriodDialog?.priceNote ?? ""}
                    onChange={(e) =>
                      setEditPeriodDialog((prev) =>
                        prev ? { ...prev, priceNote: e.target.value } : null,
                      )
                    }
                  />
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="ghost"
                  className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setEditPeriodDeleteConfirm(true)}
                  disabled={editPeriodSaving}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete period
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditPeriodDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveEditPeriod} disabled={editPeriodSaving}>
                    {editPeriodSaving && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Save
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* adjustment dialog */}
      <Dialog open={!!adjustDialog} onOpenChange={(open) => !open && setAdjustDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust payment amount</DialogTitle>
            <DialogDescription>
              Override the share for {adjustDialog?.memberNickname}. Original
              amount: {adjustDialog?.currentAmount} {currency}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="adjustedAmount">Adjusted amount ({currency})</Label>
              <Input
                id="adjustedAmount"
                type="number"
                step="0.01"
                placeholder={String(adjustDialog?.currentAmount ?? "")}
                value={adjustDialog?.adjustedAmount ?? ""}
                onChange={(e) =>
                  setAdjustDialog((prev) =>
                    prev ? { ...prev, adjustedAmount: e.target.value } : null,
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to reset to the original calculated amount.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjustmentReason">Reason</Label>
              <Textarea
                id="adjustmentReason"
                placeholder="e.g. price increase for this month"
                rows={2}
                value={adjustDialog?.reason ?? ""}
                onChange={(e) =>
                  setAdjustDialog((prev) =>
                    prev ? { ...prev, reason: e.target.value } : null,
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveAdjustment} disabled={adjustSaving}>
              {adjustSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
