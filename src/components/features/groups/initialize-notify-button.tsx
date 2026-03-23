"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InitializeNotifyButtonProps {
  groupId: string;
  memberCount: number;
  initializedAt: string | null;
}

export function InitializeNotifyButton({
  groupId,
  memberCount,
  initializedAt,
}: InitializeNotifyButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyInitialized = !!initializedAt;

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/initialize`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "Failed to send notifications.");
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={alreadyInitialized ? "outline" : "default"}
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4" />
        {alreadyInitialized ? "Re-notify group" : "Initialize & Notify group"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {alreadyInitialized ? "Re-notify all members?" : "Initialize & Notify group?"}
            </DialogTitle>
            <DialogDescription>
              {alreadyInitialized
                ? "This will send the invite email again to all active members. Use this if someone did not receive it or you changed group details."
                : `An invite email will be sent to all ${memberCount} active member${memberCount !== 1 ? "s" : ""}. They will see group details, payment instructions, and how to get Telegram updates.`}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {loading ? "Sending…" : alreadyInitialized ? "Re-notify" : "Send invites"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
