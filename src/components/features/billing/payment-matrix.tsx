"use client";

import { useState, useCallback } from "react";
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
        window.location.reload();
      }
    } finally {
      setAdvanceLoading(false);
    }
  }, [groupId, advanceMonths]);

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
      <table className="w-full min-w-[360px] border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="sticky left-0 z-10 min-w-[100px] border-r bg-muted/50 px-2.5 py-2 text-left font-medium">
              Period
            </th>
            {columnOrder.map((mem) => (
              <th
                key={mem._id}
                className={cn(
                  "min-w-[72px] px-2 py-2 text-center font-medium",
                  currentMemberId === mem._id && "bg-primary/10"
                )}
              >
                <div className="truncate" title={mem.nickname}>
                  {mem.nickname}
                </div>
                <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {(() => {
                    const pay = getPaymentByMemberId(
                      periods[0]?.payments ?? [],
                      mem._id
                    );
                    return pay ? `${effectiveAmount(pay)} ${currency}` : "—";
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
              <td className="sticky left-0 z-10 border-r bg-card px-2.5 py-1.5">
                <div className="flex items-center gap-1">
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
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDateRange(period.periodStart, period.periodEnd)}
                  </div>
                )}
                {period.isFullyPaid && (
                  <span className="mt-0.5 inline-block text-[10px] text-status-confirmed">
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
                    <td key={mem._id} className="px-2 py-1.5 text-center">
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
                      "mx-auto flex h-7 w-7 items-center justify-center rounded-md border transition-all hover:opacity-90 disabled:cursor-default disabled:opacity-70",
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
                      <TooltipTrigger>{cellButton}</TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {tooltipContent}
                      </TooltipContent>
                    </Tooltip>
                  );

                const hasConfirmedDates =
                  (payment.status === "confirmed" || payment.status === "waived") &&
                  (payment.memberConfirmedAt || payment.adminConfirmedAt);

                return (
                  <td key={mem._id} className="px-2 py-1.5">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="relative inline-flex">
                        {interactiveCell}
                        {payment.adjustedAmount != null && (
                          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500" title="Amount adjusted" />
                        )}
                      </div>
                      {hasConfirmedDates && (
                        <div className="text-[9px] text-muted-foreground leading-tight">
                          {payment.memberConfirmedAt && (
                            <span>Member: {formatDateShort(payment.memberConfirmedAt)}</span>
                          )}
                          {payment.memberConfirmedAt && payment.adminConfirmedAt && " · "}
                          {payment.adminConfirmedAt && (
                            <span>Admin: {formatDateShort(payment.adminConfirmedAt)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* advance periods */}
      {isAdmin && (
        <>
          <div className="flex justify-end border-t px-4 py-3">
            <Button variant="outline" size="sm" onClick={() => setAdvanceOpen(true)}>
              Generate upcoming periods
            </Button>
          </div>
          <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Generate future periods</DialogTitle>
                <DialogDescription>
                  Create billing periods ahead of time so members can pay in advance.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="advanceMonths">Months ahead (1–12)</Label>
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
