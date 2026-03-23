"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TaskItem = {
  _id: string;
  type: string;
  status: string;
  runAt: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  summary: string;
};

type Pagination = { page: number; totalPages: number; total: number };

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "locked", label: "Locked" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "payment_reminder", label: "Payment reminder" },
  {
    value: "aggregated_payment_reminder",
    label: "Aggregated payment reminder",
  },
  { value: "admin_confirmation_request", label: "Admin confirmation" },
  { value: "price_change", label: "Price change" },
  { value: "invite", label: "Invite" },
  { value: "follow_up", label: "Follow up" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ScheduledTasksPanel() {
  const [items, setItems] = useState<TaskItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actionId, setActionId] = useState<string | null>(null);

  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkEmail, setBulkEmail] = useState("");
  const [bulkType, setBulkType] = useState("all");
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    const res = await fetch(`/api/scheduled-tasks?${params}`, {
      credentials: "include",
    });
    const json = (await res.json()) as {
      data?: { items: TaskItem[]; pagination: Pagination };
      error?: { message?: string };
    };
    if (!res.ok) {
      setError(json.error?.message ?? "Failed to load");
      setItems([]);
      setPagination(null);
    } else if (json.data) {
      setItems(json.data.items);
      setPagination(json.data.pagination);
    }
    setLoading(false);
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchTask(taskId: string, action: "cancel" | "retry") {
    setActionId(taskId);
    try {
      const res = await fetch(`/api/scheduled-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        setError(j.error?.message ?? "Action failed");
      } else {
        await load();
      }
    } finally {
      setActionId(null);
    }
  }

  async function bulkCancel() {
    const body: {
      groupId?: string;
      memberEmail?: string;
      type?: string;
    } = {};
    if (bulkGroupId.trim()) body.groupId = bulkGroupId.trim();
    if (bulkEmail.trim()) body.memberEmail = bulkEmail.trim();
    if (bulkType !== "all") body.type = bulkType;

    if (!body.groupId && !body.memberEmail && !body.type) {
      setError("Choose at least one filter for bulk cancel (group id, email, or type)");
      return;
    }

    setBulkLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduled-tasks/bulk-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        data?: { cancelled: number };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Bulk cancel failed");
      } else {
        await load();
      }
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <RefreshCw className="size-5" />
          Scheduled notification tasks
        </CardTitle>
        <CardDescription>
          Pending and future-dated tasks for groups you administer. Cancel
          stuck reminders or retry failed deliveries. Day-scoped reminders
          re-enqueue when a period is still unpaid — cancel here to stop the
          queue without changing billing data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="st-status">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v ?? "all");
                setPage(1);
              }}
            >
              <SelectTrigger id="st-status" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="st-type">Type</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v ?? "all");
                setPage(1);
              }}
            >
              <SelectTrigger id="st-type" className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        </div>

        <div className="rounded-xl border border-dashed p-4">
          <p className="mb-3 text-sm font-medium">Bulk cancel</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Cancels pending or locked tasks only. Provide at least one filter.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-gid" className="text-xs">
                Group ID (optional)
              </Label>
              <Input
                id="bulk-gid"
                placeholder="Mongo ObjectId"
                value={bulkGroupId}
                onChange={(e) => setBulkGroupId(e.target.value)}
                className="w-[180px] font-mono text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-email" className="text-xs">
                Member email (aggregated reminders)
              </Label>
              <Input
                id="bulk-email"
                type="email"
                placeholder="member@example.com"
                value={bulkEmail}
                onChange={(e) => setBulkEmail(e.target.value)}
                className="w-[220px]"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Task type</Label>
              <Select
                value={bulkType}
                onValueChange={(v) => setBulkType(v ?? "all")}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void bulkCancel()}
              disabled={bulkLoading}
            >
              {bulkLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Cancel matching tasks
            </Button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
            No scheduled tasks match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Run at</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell className="max-w-[140px] truncate text-xs capitalize">
                      {t.type.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "failed"
                            ? "destructive"
                            : t.status === "cancelled"
                              ? "secondary"
                              : t.status === "completed"
                                ? "default"
                                : "outline"
                        }
                        className="capitalize"
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {formatDate(t.runAt)}
                    </TableCell>
                    <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                      {t.summary}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {t.attempts}/{t.maxAttempts}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {(t.status === "pending" || t.status === "locked") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionId === t._id}
                            onClick={() => void patchTask(t._id, "cancel")}
                          >
                            {actionId === t._id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            Cancel
                          </Button>
                        )}
                        {t.status === "failed" && (
                          <Button
                            size="sm"
                            disabled={actionId === t._id}
                            onClick={() => void patchTask(t._id, "retry")}
                          >
                            {actionId === t._id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            Retry
                          </Button>
                        )}
                      </div>
                      {t.lastError ? (
                        <p
                          className={cn(
                            "mt-1 max-w-[240px] truncate text-left text-xs text-destructive",
                            "md:text-right"
                          )}
                          title={t.lastError}
                        >
                          {t.lastError}
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} (
              {pagination.total} total)
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
