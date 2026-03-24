"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Layers,
  Loader2,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SkipReason =
  | "unsubscribed_from_email"
  | "email_pref_off"
  | "telegram_pref_off"
  | "no_telegram_link"
  | "no_reachable_channel";

type ChannelPreference = "email" | "telegram" | "both";

interface PreviewPayment {
  paymentId: string;
  memberEmail: string;
  memberNickname: string;
  sendEmail: boolean;
  sendTelegram: boolean;
  skipReasons: SkipReason[];
}

interface PreviewByUserEntry {
  memberEmail: string;
  memberNickname: string;
  totalAmount: number;
  sendEmail: boolean;
  sendTelegram: boolean;
  skipReasons: SkipReason[];
  payments: Array<{
    paymentId: string;
    groupId: string;
    groupName: string;
    periodId: string;
    periodLabel: string;
    amount: number;
    currency: string;
    status: string;
  }>;
}

interface PreviewSummary {
  byGroup: Array<{
    groupId: string;
    groupName: string;
    periods: Array<{
      periodId: string;
      periodLabel: string;
      payments: PreviewPayment[];
    }>;
  }>;
  byUser?: PreviewByUserEntry[];
  aggregateReminders?: boolean;
  summary: {
    totalPayments: number;
    totalSendEmail: number;
    totalSendTelegram: number;
    skipReasonCounts: Record<SkipReason, number>;
  };
}

interface SendResult {
  emailSent: number;
  telegramSent: number;
  skipped: number;
  failed: number;
}

const SKIP_LABELS: Record<SkipReason, string> = {
  unsubscribed_from_email: "Unsubscribed from email",
  email_pref_off: "Email notifications off",
  telegram_pref_off: "Telegram notifications off",
  no_telegram_link: "Telegram not linked",
  no_reachable_channel: "No reachable channel",
};

function memberInitials(display: string): string {
  const t = display.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return t.slice(0, 2).toUpperCase();
}

function NotifyStatChip({
  icon: Icon,
  count,
  label,
  sublabel,
}: {
  icon: typeof Mail;
  count: number;
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-background/80 px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{count}</p>
      {sublabel ? (
        <p className="text-xs text-muted-foreground leading-snug">{sublabel}</p>
      ) : null}
    </div>
  );
}

function wouldReceiveForChannel(
  p: PreviewPayment,
  channel: ChannelPreference
): boolean {
  if (channel === "email") return p.sendEmail;
  if (channel === "telegram") return p.sendTelegram;
  return p.sendEmail || p.sendTelegram;
}

interface NotifyUnpaidButtonProps {
  disabled?: boolean;
  onSent?: () => void;
}

export function NotifyUnpaidButton({ disabled, onSent }: NotifyUnpaidButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [channelPreference, setChannelPreference] =
    useState<ChannelPreference>("both");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(
    new Set()
  );

  const loadPreview = useCallback(async () => {
    setPreview(null);
    setPreviewError(null);
    setSendResult(null);
    setSendError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/dashboard/notify-unpaid");
      const json = await res.json();
      if (!res.ok) {
        setPreviewError(json.error?.message ?? "Failed to load preview.");
        return;
      }
      const data = json.data as PreviewSummary;
      setPreview(data);
      const allGroupIds = new Set(data.byGroup.map((g) => g.groupId));
      setSelectedGroupIds(allGroupIds);
      const allEligiblePaymentIds = new Set<string>();
      for (const g of data.byGroup) {
        for (const per of g.periods) {
          for (const p of per.payments) {
            if (p.sendEmail || p.sendTelegram) allEligiblePaymentIds.add(p.paymentId);
          }
        }
      }
      setSelectedPaymentIds(allEligiblePaymentIds);
    } catch {
      setPreviewError("Something went wrong. Try again.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setPreview(null);
      setPreviewError(null);
      setSendResult(null);
      setSendError(null);
      setSelectedGroupIds(new Set());
      setSelectedPaymentIds(new Set());
      setChannelPreference("both");
    }
  }, []);

  const eligiblePaymentIdsForSelection = useMemo(() => {
    if (!preview) return new Set<string>();
    const set = new Set<string>();
    for (const g of preview.byGroup) {
      if (!selectedGroupIds.has(g.groupId)) continue;
      for (const per of g.periods) {
        for (const p of per.payments) {
          if (wouldReceiveForChannel(p, channelPreference)) set.add(p.paymentId);
        }
      }
    }
    return set;
  }, [preview, selectedGroupIds, channelPreference]);

  const selectedCounts = useMemo(() => {
    let email = 0;
    let telegram = 0;
    if (!preview) return { email: 0, telegram: 0, total: 0, userCount: 0 };
    if (preview.aggregateReminders && preview.byUser?.length) {
      const selectedUserEmails = new Set<string>();
      for (const u of preview.byUser) {
        const hasSelected =
          u.payments.some(
            (p) =>
              selectedPaymentIds.has(p.paymentId) &&
              selectedGroupIds.has(p.groupId)
          );
        if (hasSelected) selectedUserEmails.add(u.memberEmail);
      }
      for (const u of preview.byUser) {
        if (!selectedUserEmails.has(u.memberEmail)) continue;
        if (channelPreference === "email" && u.sendEmail) email += 1;
        else if (channelPreference === "telegram" && u.sendTelegram) telegram += 1;
        else {
          if (u.sendEmail) email += 1;
          if (u.sendTelegram) telegram += 1;
        }
      }
      return {
        email,
        telegram,
        total: Array.from(selectedPaymentIds).filter((id) =>
          eligiblePaymentIdsForSelection.has(id)
        ).length,
        userCount: selectedUserEmails.size,
      };
    }
    for (const g of preview.byGroup) {
      if (!selectedGroupIds.has(g.groupId)) continue;
      for (const per of g.periods) {
        for (const p of per.payments) {
          if (!selectedPaymentIds.has(p.paymentId)) continue;
          if (channelPreference === "email" && p.sendEmail) email += 1;
          else if (channelPreference === "telegram" && p.sendTelegram)
            telegram += 1;
          else {
            if (p.sendEmail) email += 1;
            if (p.sendTelegram) telegram += 1;
          }
        }
      }
    }
    return {
      email,
      telegram,
      total: Array.from(selectedPaymentIds).filter((id) =>
        eligiblePaymentIdsForSelection.has(id)
      ).length,
      userCount: 0,
    };
  }, [
    preview,
    selectedGroupIds,
    selectedPaymentIds,
    channelPreference,
    eligiblePaymentIdsForSelection,
  ]);

  const toggleGroup = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const togglePayment = useCallback((paymentId: string) => {
    setSelectedPaymentIds((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  }, []);

  const selectAllGroups = useCallback(() => {
    if (!preview) return;
    setSelectedGroupIds(new Set(preview.byGroup.map((g) => g.groupId)));
  }, [preview]);

  const deselectAllGroups = useCallback(() => {
    setSelectedGroupIds(new Set());
  }, []);

  const selectAllPayments = useCallback(() => {
    setSelectedPaymentIds(new Set(eligiblePaymentIdsForSelection));
  }, [eligiblePaymentIdsForSelection]);

  const deselectAllPayments = useCallback(() => {
    setSelectedPaymentIds(new Set());
  }, []);

  const canSend =
    (preview?.aggregateReminders
      ? selectedCounts.userCount > 0
      : selectedCounts.total > 0) &&
    (selectedCounts.email > 0 || selectedCounts.telegram > 0);
  const showResult = sendResult !== null;

  async function handleConfirm() {
    setSendError(null);
    setSending(true);
    try {
      const res = await fetch("/api/dashboard/notify-unpaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupIds: Array.from(selectedGroupIds),
          paymentIds: Array.from(selectedPaymentIds),
          channelPreference,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setSendError(json.error?.message ?? "Failed to send reminders.");
        setSending(false);
        return;
      }

      setSendResult(json.data);
      onSent?.();
      router.refresh();
    } catch {
      setSendError("Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="lg"
        disabled={disabled}
        onClick={() => {
          loadPreview();
          setOpen(true);
        }}
        className="w-full gap-2 rounded-xl bg-primary px-5 py-3 text-base font-semibold shadow-md ring-1 ring-primary/20 transition-shadow hover:shadow-lg disabled:opacity-60 sm:w-auto"
      >
        <Bell className="size-5 shrink-0" />
        Notify all unpaid
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[min(92vh,56rem)] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 shadow-xl ring-foreground/15 sm:w-full">
          <div className="max-h-[min(92vh,56rem)] overflow-y-auto p-6 pb-4">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Notify all unpaid
              </DialogTitle>
              <DialogDescription className="text-base">
                Pick channels, groups, and members. One combined reminder per
                member. Unsubscribed members won&apos;t get email.
              </DialogDescription>
            </DialogHeader>

          {previewLoading && (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Loading preview…</span>
            </div>
          )}

          {previewError && (
            <p role="alert" className="text-sm text-destructive">
              {previewError}
            </p>
          )}

          {preview && !previewLoading && (
            <div className="space-y-4">
              {preview.summary.totalPayments === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No unpaid (pending or overdue) payments in your groups.
                </p>
              ) : (
                <>
                  {/* Channel preference */}
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                    <p className="text-sm font-medium">Delivery channel</p>
                    <div
                      className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-1 sm:flex-row"
                      role="radiogroup"
                      aria-label="Channel for this send"
                    >
                      {(
                        [
                          {
                            value: "both" as const,
                            label: "Both",
                            hint: "respect preferences",
                            Icon: Layers,
                          },
                          {
                            value: "email" as const,
                            label: "Email",
                            hint: "only",
                            Icon: Mail,
                          },
                          {
                            value: "telegram" as const,
                            label: "Telegram",
                            hint: "only",
                            Icon: MessageCircle,
                          },
                        ] as const
                      ).map(({ value, label, hint, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={channelPreference === value}
                          onClick={() => setChannelPreference(value)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium transition-colors sm:flex-col sm:py-2",
                            channelPreference === value
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="flex flex-col items-center gap-0 leading-tight sm:text-center">
                            <span>{label}</span>
                            <span
                              className={cn(
                                "text-[11px] font-normal",
                                channelPreference === value
                                  ? "text-primary-foreground/80"
                                  : "text-muted-foreground"
                              )}
                            >
                              {hint}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary from selection */}
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                    <p className="text-sm font-medium">Summary</p>
                    <div className="grid grid-cols-2 gap-3">
                      {preview.aggregateReminders && selectedCounts.userCount > 0 ? (
                        <>
                          <NotifyStatChip
                            icon={Mail}
                            count={selectedCounts.email}
                            label="Email"
                            sublabel="users · one email each"
                          />
                          <NotifyStatChip
                            icon={MessageCircle}
                            count={selectedCounts.telegram}
                            label="Telegram"
                            sublabel="users · one message each"
                          />
                        </>
                      ) : (
                        <>
                          <NotifyStatChip
                            icon={Mail}
                            count={selectedCounts.email}
                            label="Email"
                            sublabel="reminders"
                          />
                          <NotifyStatChip
                            icon={MessageCircle}
                            count={selectedCounts.telegram}
                            label="Telegram"
                            sublabel="reminders"
                          />
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {preview.aggregateReminders ? (
                        <>
                          {selectedCounts.userCount} user
                          {selectedCounts.userCount !== 1 ? "s" : ""} selected
                          {selectedCounts.userCount > 0 ? " (aggregated)" : ""}
                        </>
                      ) : (
                        <>
                          {selectedCounts.total} payment
                          {selectedCounts.total !== 1 ? "s" : ""} selected
                        </>
                      )}
                    </p>
                    {selectedCounts.total === 0 && !preview.aggregateReminders && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Select at least one group and one member to send.
                      </p>
                    )}
                    {selectedCounts.userCount === 0 &&
                      preview.aggregateReminders && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Select at least one group and one member to send.
                        </p>
                      )}
                  </div>

                  {/* By user (when aggregation is on) */}
                  {preview.aggregateReminders && preview.byUser && preview.byUser.length > 0 && (
                    <div className="rounded-lg border p-4 space-y-3">
                      <p className="text-sm font-medium">
                        By user (one notification per user)
                      </p>
                      <ul className="text-sm space-y-2 max-h-48 overflow-y-auto">
                        {preview.byUser.map((u) => {
                          const selected = u.payments.some(
                            (p) =>
                              selectedPaymentIds.has(p.paymentId) &&
                              selectedGroupIds.has(p.groupId)
                          );
                          const displayName = u.memberNickname || u.memberEmail;
                          return (
                            <li
                              key={u.memberEmail}
                              className={cn(
                                "flex flex-wrap items-center gap-3 rounded-md border border-transparent px-1 py-1.5",
                                !selected ? "opacity-40" : ""
                              )}
                            >
                              <div
                                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                                aria-hidden
                              >
                                {memberInitials(displayName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{displayName}</div>
                                <div className="text-muted-foreground text-xs sm:text-sm">
                                  {u.payments.length} group
                                  {u.payments.length !== 1 ? "s" : ""} · total{" "}
                                  {u.totalAmount.toFixed(2)}
                                  {u.payments[0]?.currency ?? ""}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                {u.sendEmail && (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                    email
                                  </span>
                                )}
                                {u.sendTelegram && (
                                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                                    Telegram
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {Object.entries(preview.summary.skipReasonCounts).some(
                    ([, n]) => n > 0
                  ) && (
                    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-sm font-medium">Skipped (no send)</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {Object.entries(preview.summary.skipReasonCounts).map(
                            ([reason, count]) =>
                              count > 0 ? (
                                <li key={reason} className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                                  <span className="font-medium tabular-nums text-foreground">
                                    {count}
                                  </span>
                                  <span className="text-muted-foreground">×</span>
                                  <span>{SKIP_LABELS[reason as SkipReason]}</span>
                                </li>
                              ) : null
                          )}
                        </ul>
                        {preview.summary.skipReasonCounts.unsubscribed_from_email >
                          0 && (
                          <p className="text-xs text-muted-foreground pt-0.5">
                            Members who unsubscribed from group emails will not
                            receive reminders by email.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Groups */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Groups</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={selectAllGroups}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={deselectAllGroups}
                        >
                          Deselect all
                        </Button>
                      </div>
                    </div>
                    <ul className="text-sm space-y-2 max-h-32 overflow-y-auto">
                      {preview.byGroup.map((g) => (
                        <li key={g.groupId} className="flex items-center gap-2">
                          <Checkbox
                            id={`group-${g.groupId}`}
                            checked={selectedGroupIds.has(g.groupId)}
                            onCheckedChange={() => toggleGroup(g.groupId)}
                          />
                          <Label
                            htmlFor={`group-${g.groupId}`}
                            className="font-medium cursor-pointer"
                          >
                            {g.groupName}
                          </Label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Members by group */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Members</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={selectAllPayments}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={deselectAllPayments}
                        >
                          Deselect all
                        </Button>
                      </div>
                    </div>
                    <ul className="text-sm space-y-2 max-h-40 overflow-y-auto">
                      {preview.byGroup.map((g) => {
                        if (!selectedGroupIds.has(g.groupId)) return null;
                        return (
                          <li key={g.groupId}>
                            <span className="font-medium text-muted-foreground">
                              {g.groupName}
                            </span>
                            <ul className="ml-4 mt-1 space-y-1">
                              {g.periods.map((per) =>
                                per.payments.map((p) => {
                                  const eligible =
                                    wouldReceiveForChannel(p, channelPreference);
                                  const checked =
                                    selectedPaymentIds.has(p.paymentId);
                                  return (
                                    <li
                                      key={p.paymentId}
                                      className={`flex items-center gap-2 ${
                                        !eligible ? "opacity-50" : ""
                                      }`}
                                    >
                                      <Checkbox
                                        id={`pay-${p.paymentId}`}
                                        checked={checked}
                                        disabled={!eligible}
                                        onCheckedChange={() =>
                                          eligible && togglePayment(p.paymentId)
                                        }
                                      />
                                      <Label
                                        htmlFor={`pay-${p.paymentId}`}
                                        className={`cursor-pointer ${
                                          !eligible
                                            ? "cursor-not-allowed"
                                            : ""
                                        }`}
                                      >
                                        {p.memberNickname || p.memberEmail}{" "}
                                        <span className="text-muted-foreground">
                                          ({per.periodLabel})
                                        </span>
                                        {" — "}
                                        {channelPreference === "email" &&
                                          p.sendEmail && (
                                            <span className="text-muted-foreground">
                                              email
                                            </span>
                                          )}
                                        {channelPreference === "telegram" &&
                                          p.sendTelegram && (
                                            <span className="text-muted-foreground">
                                              Telegram
                                            </span>
                                          )}
                                        {channelPreference === "both" && (
                                          <span className="text-muted-foreground">
                                            {[
                                              p.sendEmail && "email",
                                              p.sendTelegram && "Telegram",
                                            ]
                                              .filter(Boolean)
                                              .join(" + ")}
                                          </span>
                                        )}
                                      </Label>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {showResult && sendResult !== null && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-medium">Done</p>
              <ul className="text-sm text-muted-foreground">
                <li>Email sent: {sendResult.emailSent}</li>
                <li>Telegram sent: {sendResult.telegramSent}</li>
                <li>Skipped: {sendResult.skipped}</li>
                {sendResult.failed > 0 && (
                  <li className="text-destructive">Failed: {sendResult.failed}</li>
                )}
              </ul>
            </div>
          )}

          {sendError ? (
            <p role="alert" className="text-sm text-destructive">
              {sendError}
            </p>
          ) : null}
          </div>

          {preview && !previewLoading && (
            <DialogFooter className="mx-0 mt-0 shrink-0 flex-wrap gap-2 border-t px-6 py-4">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                {showResult ? "Close" : "Cancel"}
              </Button>
              {!showResult && canSend && (
                <Button onClick={handleConfirm} disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Confirm"
                  )}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
