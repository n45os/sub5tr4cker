"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type TelegramLinkCardProps = {
  isLinked: boolean;
  username: string | null;
  linkedAt: string | null;
  /** when linked: receive reminders and confirmation nudges via Telegram */
  telegramNotifications?: boolean;
};

export function TelegramLinkCard({
  isLinked,
  username,
  linkedAt,
  telegramNotifications: initialTelegramNotifications = false,
}: TelegramLinkCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramNotifications, setTelegramNotifications] = useState(
    initialTelegramNotifications
  );
  const [pendingLink, setPendingLink] = useState<{
    deepLink: string;
    botUsername: string;
  } | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  useEffect(() => {
    setTelegramNotifications(initialTelegramNotifications);
  }, [initialTelegramNotifications]);

  async function handleConnect() {
    setError(null);
    setPendingLink(null);
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 503) {
          setError("Telegram is not configured. Add a bot token in Settings.");
        } else {
          setError(json.error?.message ?? "Failed to generate link.");
        }
        setLoading(false);
        return;
      }

      setPendingLink({
        deepLink: json.data.deepLink,
        botUsername: json.data.botUsername,
      });
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "DELETE" });
      let json: { error?: { message?: string } };
      try {
        json = await res.json();
      } catch {
        setError(res.ok ? "Something went wrong. Try again." : "Failed to disconnect.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(json.error?.message ?? "Failed to disconnect.");
        setLoading(false);
        return;
      }

      setPendingLink(null);
      setDisconnectOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const linkedDate =
    linkedAt &&
    new Date(linkedAt).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });

  async function handleTelegramNotificationsChange(checked: boolean) {
    setTelegramNotifications(checked);
    setError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPreferences: { telegram: checked },
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setTelegramNotifications(initialTelegramNotifications);
        setError(json.error?.message ?? "Failed to update.");
        return;
      }
      router.refresh();
    } catch {
      setTelegramNotifications(initialTelegramNotifications);
      setError("Failed to update.");
    }
  }

  if (isLinked) {
    return (
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">
            {username ? `Connected as @${username}` : "Telegram connected"}
          </p>
          {linkedDate ? (
            <p className="text-muted-foreground">Linked on {linkedDate}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="telegram-notifications">
              Receive notifications via Telegram
            </Label>
            <p className="text-xs text-muted-foreground">
              Reminders and confirmation nudges
            </p>
          </div>
          <Switch
            id="telegram-notifications"
            checked={telegramNotifications}
            onCheckedChange={handleTelegramNotificationsChange}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDisconnectOpen(true)}
          disabled={loading}
        >
          Disconnect
        </Button>
        <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Disconnect Telegram?</DialogTitle>
              <DialogDescription>
                You will stop receiving reminders and confirmation nudges on Telegram
                until you link your account again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDisconnectOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDisconnect()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Disconnect"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (pendingLink) {
    return (
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Open Telegram and start a chat with @{pendingLink.botUsername}, or
          click the link below. This link expires in 15 minutes.
        </p>
        <a
          href={pendingLink.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Open in Telegram
          <ExternalLink className="size-4" />
        </a>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Regenerate link"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.refresh()}
          >
            I&apos;ve linked my account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Link your Telegram account to receive confirmation nudges and use
        Telegram notifications.
      </p>
      <Button
        type="button"
        onClick={handleConnect}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Connect Telegram"
        )}
      </Button>
    </div>
  );
}
