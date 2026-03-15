"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MemberTelegramLinkProps {
  portalToken: string;
  telegramLinked?: boolean;
  telegramUsername?: string | null;
  telegramLinkedAt?: string | null;
}

export function MemberTelegramLink({
  portalToken,
  telegramLinked = false,
  telegramUsername = null,
  telegramLinkedAt = null,
}: MemberTelegramLinkProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLink, setPendingLink] = useState<{
    deepLink: string;
    botUsername: string;
  } | null>(null);

  const linkedDate =
    telegramLinkedAt &&
    new Date(telegramLinkedAt).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });

  async function handleConnect() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/member/${portalToken}/telegram-link`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "Failed to generate link.");
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

  if (telegramLinked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <CardDescription>
            Payment reminders and confirmations can be sent to your linked Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">
              {telegramUsername ? `Connected as @${telegramUsername}` : "Telegram connected"}
            </p>
            {linkedDate ? (
              <p className="text-muted-foreground">Linked on {linkedDate}</p>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            To disconnect, use your Profile when signed in.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Telegram</CardTitle>
        <CardDescription>
          Link your Telegram to receive payment reminders and confirm payments directly from Telegram.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        )}
        {pendingLink ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open Telegram and start a chat with @{pendingLink.botUsername}. This link expires in 15 minutes.
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
              <Button variant="outline" size="sm" onClick={handleConnect} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Regenerate link"}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Connect Telegram"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
