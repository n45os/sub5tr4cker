"use client";

import { useCallback, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkConfirmButtonProps {
  groupId: string;
  periodId: string;
  /** member ids whose payment is currently in `member_confirmed` */
  memberConfirmedIds: string[];
  /** called for each member id that has just been admin-confirmed by this run */
  onMemberConfirmed: (memberId: string) => void;
}

export function BulkConfirmButton({
  groupId,
  periodId,
  memberConfirmedIds,
  onMemberConfirmed,
}: BulkConfirmButtonProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = memberConfirmedIds.length;
  const disabled = total === 0 || running;

  const runBulkConfirm = useCallback(async () => {
    if (total === 0 || running) return;
    setRunning(true);
    setError(null);
    setProgress({ done: 0, total });

    const ids = [...memberConfirmedIds];
    for (let i = 0; i < ids.length; i++) {
      const memberId = ids[i];
      try {
        const res = await fetch(
          `/api/groups/${groupId}/billing/${periodId}/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId, action: "confirm" }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = body?.error?.message ?? `Failed at ${i + 1}/${total}`;
          setError(msg);
          setRunning(false);
          return;
        }
        onMemberConfirmed(memberId);
        setProgress({ done: i + 1, total });
      } catch {
        setError(`Network error at ${i + 1}/${total}`);
        setRunning(false);
        return;
      }
    }

    setRunning(false);
    // leave progress visible briefly, then clear
    setTimeout(() => setProgress(null), 1500);
  }, [groupId, periodId, memberConfirmedIds, onMemberConfirmed, running, total]);

  if (total === 0 && !progress && !error) return null;

  const label = running && progress
    ? `Confirming ${progress.done}/${progress.total}…`
    : `Confirm all (${total})`;

  return (
    <div className="mt-1 flex flex-col items-start gap-0.5">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={runBulkConfirm}
        className="h-6 gap-1 px-2 text-[10px]"
      >
        {running ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Check className="size-3" />
        )}
        {label}
      </Button>
      <span aria-live="polite" className="text-[10px] text-muted-foreground">
        {error
          ? error
          : progress && !running
            ? `Done ${progress.done}/${progress.total}`
            : ""}
      </span>
    </div>
  );
}
