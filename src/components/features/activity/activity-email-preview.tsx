"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ActivityEmailPreviewProps {
  notificationId: string;
}

export function ActivityEmailPreview({ notificationId }: ActivityEmailPreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    setUnavailableReason(null);
    setHtml(null);
    try {
      const res = await fetch(
        `/api/activity/notifications/${notificationId}/email`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        data?: { html?: string; unavailable?: boolean; reason?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to load email");
        return;
      }
      if (json.data?.unavailable && json.data.reason) {
        setUnavailableReason(json.data.reason);
        return;
      }
      if (json.data?.html) {
        setHtml(json.data.html);
        return;
      }
      setError("Unexpected response");
    } catch {
      setError("Failed to load email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (next) void loadPreview();
        else {
          setHtml(null);
          setUnavailableReason(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" type="button">
            View email
          </Button>
        }
      />
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Sent email</DialogTitle>
          <DialogDescription>
            Rebuilt from the saved template data for this notification.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-[200px] flex-1 border-t px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : unavailableReason ? (
            <p className="text-sm text-muted-foreground">{unavailableReason}</p>
          ) : html ? (
            <iframe
              title="Email preview"
              className="h-[min(70vh,560px)] w-full rounded-md border bg-white"
              sandbox="allow-same-origin"
              srcDoc={html}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
