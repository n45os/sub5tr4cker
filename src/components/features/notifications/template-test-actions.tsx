"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TemplateTestActionsProps {
  channels: Array<"email" | "telegram">;
}

export function TemplateTestActions({ channels }: TemplateTestActionsProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState<"email" | "telegram" | null>(null);

  async function sendTest(kind: "email" | "telegram") {
    setSending(kind);
    setStatus(null);

    try {
      const response = await fetch(`/api/settings/test-${kind}`, { method: "POST" });
      const json = await response.json();

      if (!response.ok) {
        setStatus(json.error?.message || `Failed to send ${kind} test.`);
        return;
      }

      setStatus(
        kind === "email"
          ? "Test email sent successfully."
          : "Test Telegram message sent successfully."
      );
    } catch {
      setStatus(`Failed to send ${kind} test.`);
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {channels.includes("email") ? (
          <Button
            variant="outline"
            onClick={() => sendTest("email")}
            disabled={sending === "email"}
          >
            {sending === "email" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send test email
          </Button>
        ) : null}
        {channels.includes("telegram") ? (
          <Button
            variant="outline"
            onClick={() => sendTest("telegram")}
            disabled={sending === "telegram"}
          >
            {sending === "telegram" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send test Telegram
          </Button>
        ) : null}
      </div>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
