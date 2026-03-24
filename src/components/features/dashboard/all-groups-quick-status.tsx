"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AllGroupsQuickStatusCard } from "./all-groups-quick-status-card";
import { NotifyUnpaidButton } from "./notify-unpaid-button";

interface QuickStatusData {
  totalGroups: number;
  groupsNeedingAttention: number;
  groupsEligibleForReminders: number;
  pendingCount: number;
  overdueCount: number;
  memberConfirmedCount: number;
}

export function AllGroupsQuickStatus() {
  const [data, setData] = useState<QuickStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => setLoading(true));
    fetch("/api/dashboard/quick-status")
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Failed to load")))
      .then((json) => {
        if (!cancelled && json.data) setData(json.data);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <AllGroupsQuickStatusCard>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Loading status…</span>
        </div>
      </AllGroupsQuickStatusCard>
    );
  }

  if (!data) {
    return (
      <AllGroupsQuickStatusCard>
        <p className="text-sm text-muted-foreground">Could not load quick status.</p>
      </AllGroupsQuickStatusCard>
    );
  }

  const canSendPaymentReminders = data.pendingCount + data.overdueCount > 0;

  return (
    <AllGroupsQuickStatusCard>
      <div className="grid min-w-0 gap-4">
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 *:min-w-0">
          <div className="min-w-0 rounded-xl border bg-muted/40 p-3">
            <p className="truncate text-xs text-muted-foreground">Groups</p>
            <p className="font-mono text-lg font-semibold tabular-nums">{data.totalGroups}</p>
          </div>
          <div className="min-w-0 rounded-xl border bg-muted/40 p-3">
            <p className="truncate text-xs text-muted-foreground">Open follow-ups</p>
            <p className="font-mono text-lg font-semibold tabular-nums">{data.groupsNeedingAttention}</p>
            <p className="truncate pt-1 text-[11px] text-muted-foreground">
              Pending, overdue, or awaiting your confirm
            </p>
          </div>
          <div className="min-w-0 rounded-xl border bg-muted/40 p-3">
            <p className="truncate text-xs text-muted-foreground">Pending / Overdue</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {data.pendingCount} / {data.overdueCount}
            </p>
            <p className="truncate pt-1 text-[11px] text-muted-foreground">
              {data.groupsEligibleForReminders} group
              {data.groupsEligibleForReminders === 1 ? "" : "s"} eligible for reminders
            </p>
          </div>
          {data.memberConfirmedCount > 0 ? (
            <div className="min-w-0 rounded-xl border bg-muted/40 p-3">
              <p className="truncate text-xs text-muted-foreground">Awaiting your confirm</p>
              <p className="font-mono text-lg font-semibold tabular-nums">{data.memberConfirmedCount}</p>
            </div>
          ) : null}
        </div>
        <div className="grid gap-2">
          <NotifyUnpaidButton
            disabled={!canSendPaymentReminders}
            onSent={() => setRefreshKey((k) => k + 1)}
          />
          <p className="text-xs text-muted-foreground">
            Payment reminders only cover pending or overdue payments (not member-claimed rows
            waiting for your confirmation).
          </p>
        </div>
      </div>
    </AllGroupsQuickStatusCard>
  );
}
