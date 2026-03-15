"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImportPeriodRow {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalPrice: string;
  payments: Array<{
    memberEmail: string;
    amount: string;
    status: "confirmed" | "pending" | "waived";
  }>;
}

interface ImportHistoryDialogProps {
  groupId: string;
  memberEmails: string[];
  currency: string;
}

function emptyPeriod(): ImportPeriodRow {
  return {
    periodLabel: "",
    periodStart: "",
    periodEnd: "",
    totalPrice: "",
    payments: [],
  };
}

export function ImportHistoryDialog({
  groupId,
  memberEmails,
  currency,
}: ImportHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportPeriodRow[]>([emptyPeriod()]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRows((prev) => [...prev, emptyPeriod()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof ImportPeriodRow, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  }

  function addPayment(rowIndex: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              payments: [
                ...r.payments,
                { memberEmail: memberEmails[0] || "", amount: "", status: "confirmed" as const },
              ],
            }
          : r,
      ),
    );
  }

  function updatePayment(
    rowIndex: number,
    payIndex: number,
    field: string,
    value: string,
  ) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              payments: r.payments.map((p, pi) =>
                pi === payIndex ? { ...p, [field]: value } : p,
              ),
            }
          : r,
      ),
    );
  }

  function removePayment(rowIndex: number, payIndex: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? { ...r, payments: r.payments.filter((_, pi) => pi !== payIndex) }
          : r,
      ),
    );
  }

  async function handleImport() {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const periods = rows
        .filter((r) => r.periodStart && r.totalPrice)
        .map((r) => ({
          periodLabel: r.periodLabel || `Imported period`,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd || r.periodStart,
          totalPrice: parseFloat(r.totalPrice),
          payments: r.payments.map((p) => ({
            memberEmail: p.memberEmail,
            amount: parseFloat(p.amount) || 0,
            status: p.status,
          })),
        }));

      if (periods.length === 0) {
        setError("Add at least one period with a start date and price.");
        return;
      }

      const res = await fetch(`/api/groups/${groupId}/billing/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periods }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "Import failed.");
        return;
      }

      setResult(json.data);
      if (json.data.imported > 0) {
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 1500);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Upload className="mr-2 size-4" />
            Import history
          </Button>
        }
      />
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import billing history</DialogTitle>
          <DialogDescription>
            Add past billing periods with payment records. Existing periods with
            matching start dates will be skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {rows.map((row, idx) => (
            <div key={idx} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Period {idx + 1}</span>
                {rows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(idx)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label>Label</Label>
                  <Input
                    placeholder="e.g. Jan 2025"
                    value={row.periodLabel}
                    onChange={(e) => updateRow(idx, "periodLabel", e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Total price ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={row.totalPrice}
                    onChange={(e) => updateRow(idx, "totalPrice", e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={row.periodStart}
                    onChange={(e) => updateRow(idx, "periodStart", e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={row.periodEnd}
                    onChange={(e) => updateRow(idx, "periodEnd", e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Payments</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addPayment(idx)}
                  >
                    <Plus className="size-3" />
                    Add member
                  </Button>
                </div>
                {row.payments.map((pay, payIdx) => (
                  <div key={payIdx} className="flex items-center gap-2">
                    <Select
                      value={pay.memberEmail}
                      onValueChange={(v) =>
                        updatePayment(idx, payIdx, "memberEmail", v ?? "")
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Member email" />
                      </SelectTrigger>
                      <SelectContent>
                        {memberEmails.map((email) => (
                          <SelectItem key={email} value={email}>
                            {email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      className="w-24"
                      value={pay.amount}
                      onChange={(e) =>
                        updatePayment(idx, payIdx, "amount", e.target.value)
                      }
                    />
                    <Select
                      value={pay.status}
                      onValueChange={(v) =>
                        updatePayment(idx, payIdx, "status", v ?? "confirmed")
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="waived">Waived</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePayment(idx, payIdx)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addRow}>
            <Plus className="mr-2 size-4" />
            Add period
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <p className="text-sm text-green-600">
            Imported {result.imported} period{result.imported !== 1 ? "s" : ""}.
            {result.skipped > 0 && ` ${result.skipped} skipped (already exist).`}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing && <Loader2 className="mr-2 size-4 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
