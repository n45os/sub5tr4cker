"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ImportHistoryDialog } from "@/components/features/billing/import-history-dialog";
import { DeleteGroupButton } from "@/components/features/groups/delete-group-button";
import { InitializeNotifyButton } from "@/components/features/groups/initialize-notify-button";

type NotifyStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function GroupDetailAdminActions({
  groupId,
  groupName,
  memberCount,
  initializedAt,
  memberEmails,
  currency,
  unpaidCount,
}: {
  groupId: string;
  groupName: string;
  memberCount: number;
  initializedAt: string | null;
  memberEmails: string[];
  currency: string;
  unpaidCount: number;
}) {
  const alreadyInitialized = !!initializedAt;
  const router = useRouter();
  const [status, setStatus] = useState<NotifyStatus>({ kind: "idle" });
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

  async function handleNotify() {
    if (unpaidCount === 0 || status.kind === "sending") return;
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

  const notifyDisabled = unpaidCount === 0 || status.kind === "sending";
  const notifyButton = (
    <Button
      type="button"
      variant="default"
      onClick={handleNotify}
      disabled={notifyDisabled}
      aria-disabled={notifyDisabled}
    >
      {status.kind === "sending" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <BellRing className="size-4" />
      )}
      Notify unpaid ({unpaidCount})
    </Button>
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {unpaidCount === 0 ? (
          <Tooltip>
            <TooltipTrigger render={<span tabIndex={0}>{notifyButton}</span>} />
            <TooltipContent>No unpaid members</TooltipContent>
          </Tooltip>
        ) : (
          notifyButton
        )}

        <Link
          href={`/dashboard/groups/${groupId}/edit`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Pencil className="size-4" />
          Edit group
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
            aria-label="More group actions"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <InitializeNotifyButton
              groupId={groupId}
              memberCount={memberCount}
              initializedAt={initializedAt}
              renderTrigger={({ onClick }) => (
                <DropdownMenuItem
                  onClick={() => {
                    onClick();
                  }}
                >
                  <Bell className="size-4" />
                  {alreadyInitialized ? "Re-notify group" : "Initialize & notify"}
                </DropdownMenuItem>
              )}
            />
            <ImportHistoryDialog
              groupId={groupId}
              memberEmails={memberEmails}
              currency={currency}
              renderTrigger={({ onClick }) => (
                <DropdownMenuItem onClick={() => onClick()}>
                  <Upload className="size-4" />
                  Import history
                </DropdownMenuItem>
              )}
            />
            <DropdownMenuSeparator />
            <DeleteGroupButton
              groupId={groupId}
              groupName={groupName}
              label="Delete group"
              renderTrigger={({ onClick }) => (
                <DropdownMenuItem variant="destructive" onClick={() => onClick()}>
                  <Trash2 className="size-4" />
                  Delete group
                </DropdownMenuItem>
              )}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "min-h-[1rem] text-xs",
          status.kind === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {status.kind === "success" || status.kind === "error"
          ? status.message
          : ""}
      </p>
    </div>
  );
}
