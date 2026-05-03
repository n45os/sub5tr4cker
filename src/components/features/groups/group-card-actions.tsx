"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BellRing, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GroupCardActionsProps {
  groupId: string;
  unpaidCount: number;
  canNotify: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function GroupCardActions({
  groupId,
  unpaidCount,
  canNotify,
}: GroupCardActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  function scheduleClear() {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      setStatus({ kind: "idle" });
    }, 4000);
  }

  async function handleNotify(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!canNotify || unpaidCount === 0 || status.kind === "sending") return;

    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/dashboard/notify-unpaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds: [groupId] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: json?.error?.message ?? "Failed to send reminders",
        });
        scheduleClear();
        return;
      }
      const sent =
        (json?.data?.emailSent ?? 0) + (json?.data?.telegramSent ?? 0);
      setStatus({
        kind: "success",
        message:
          sent === 0
            ? "No reachable recipients"
            : `Sent ${sent} reminder${sent === 1 ? "" : "s"}`,
      });
      scheduleClear();
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Network error — try again" });
      scheduleClear();
    }
  }

  const notifyDisabled =
    !canNotify || unpaidCount === 0 || status.kind === "sending";
  const notifyLabel = `Notify unpaid (${unpaidCount})`;
  const tooltipMessage = !canNotify
    ? "Only group owners can notify"
    : unpaidCount === 0
      ? "No unpaid members"
      : null;

  const notifyButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleNotify}
      disabled={notifyDisabled}
      aria-disabled={notifyDisabled}
    >
      {status.kind === "sending" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <BellRing className="size-4" />
      )}
      {notifyLabel}
    </Button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {tooltipMessage ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{notifyButton}</span>
              </TooltipTrigger>
              <TooltipContent>{tooltipMessage}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          notifyButton
        )}

        <Button asChild type="button" size="sm" variant="ghost">
          <Link
            href={`/dashboard/groups/${groupId}/billing`}
            onClick={(event) => event.stopPropagation()}
          >
            <Receipt className="size-4" />
            View billing
          </Link>
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`min-h-[1rem] text-xs ${
          status.kind === "error"
            ? "text-destructive"
            : "text-muted-foreground"
        }`}
      >
        {status.kind === "success" || status.kind === "error"
          ? status.message
          : ""}
      </p>
    </div>
  );
}
