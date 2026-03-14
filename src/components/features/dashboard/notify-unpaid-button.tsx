"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SkipReason =
  | "unsubscribed_from_email"
  | "email_pref_off"
  | "telegram_pref_off"
  | "no_telegram_link"
  | "no_reachable_channel";

interface PreviewSummary {
  byGroup: Array<{
    groupId: string;
    groupName: string;
    periods: Array<{
      periodId: string;
      periodLabel: string;
      payments: Array<{
        paymentId: string;
        memberEmail: string;
        memberNickname: string;
        sendEmail: boolean;
        sendTelegram: boolean;
        skipReasons: SkipReason[];
      }>;
    }>;
  }>;
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
      setPreview(json.data);
    } catch {
      setPreviewError("Something went wrong. Try again.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) loadPreview();
      else {
        setPreview(null);
        setPreviewError(null);
        setSendResult(null);
        setSendError(null);
      }
    },
    [loadPreview]
  );

  async function handleConfirm() {
    setSendError(null);
    setSending(true);
    try {
      const res = await fetch("/api/dashboard/notify-unpaid", { method: "POST" });
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

  const canSend = preview && (preview.summary.totalSendEmail > 0 || preview.summary.totalSendTelegram > 0);
  const showResult = sendResult !== null;

  return (
    <>
      <Button
        type="button"
        variant="default"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4" />
        Notify all unpaid
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notify all unpaid</DialogTitle>
            <DialogDescription>
              Send payment reminders to members with pending or overdue payments. Delivery uses each member’s preferences; unsubscribed members will not receive email.
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
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                    <p className="text-sm font-medium">Summary</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <Mail className="size-4" />
                        {preview.summary.totalSendEmail} reminder{preview.summary.totalSendEmail !== 1 ? "s" : ""} via email
                      </li>
                      <li className="flex items-center gap-2">
                        <MessageCircle className="size-4" />
                        {preview.summary.totalSendTelegram} reminder{preview.summary.totalSendTelegram !== 1 ? "s" : ""} via Telegram
                      </li>
                      <li>{preview.summary.totalPayments} unpaid payment{preview.summary.totalPayments !== 1 ? "s" : ""} total</li>
                    </ul>
                  </div>

                  {Object.entries(preview.summary.skipReasonCounts).some(([, n]) => n > 0) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-4 space-y-2">
                      <p className="text-sm font-medium">Skipped (no send)</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {Object.entries(preview.summary.skipReasonCounts).map(
                          ([reason, count]) =>
                            count > 0 ? (
                              <li key={reason}>
                                {count} — {SKIP_LABELS[reason as SkipReason]}
                              </li>
                            ) : null
                        )}
                      </ul>
                      {preview.summary.skipReasonCounts.unsubscribed_from_email > 0 && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Members who unsubscribed from group emails will not receive reminders by email.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-medium">By group</p>
                    <ul className="text-sm space-y-2 max-h-40 overflow-y-auto">
                      {preview.byGroup.map((g) => (
                        <li key={g.groupId}>
                          <span className="font-medium">{g.groupName}</span>
                          <ul className="ml-4 mt-1 text-muted-foreground">
                            {g.periods.map((per) => (
                              <li key={per.periodId}>
                                {per.periodLabel}: {per.payments.filter((p) => p.sendEmail || p.sendTelegram).length} will receive, {per.payments.filter((p) => !p.sendEmail && !p.sendTelegram).length} skipped
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
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
                {sendResult.failed > 0 && <li className="text-destructive">Failed: {sendResult.failed}</li>}
              </ul>
            </div>
          )}

          {sendError ? (
            <p role="alert" className="text-sm text-destructive">
              {sendError}
            </p>
          ) : null}

          {preview && !previewLoading && (
            <DialogFooter showCloseButton>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                {showResult ? "Close" : "Cancel"}
              </Button>
              {!showResult && canSend && (
                <Button onClick={handleConfirm} disabled={sending}>
                  {sending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {sending ? " Sending…" : "Confirm and send"}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
