"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type TelegramLinkCardProps = {
  isLinked: boolean;
  username: string | null;
  linkedAt: string | null;
};

export function TelegramLinkCard({
  isLinked,
  username,
  linkedAt,
}: TelegramLinkCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLink, setPendingLink] = useState<{
    deepLink: string;
    botUsername: string;
  } | null>(null);

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
        <Button
          type="button"
          variant="outline"
          onClick={handleDisconnect}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Disconnect"
          )}
        </Button>
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
            I've linked my account
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
