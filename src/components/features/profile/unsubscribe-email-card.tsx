"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type UnsubscribeEmailCardProps = {
  /** when true, user receives email notifications; when false, unsubscribed */
  receiveEmail: boolean;
};

/** prominent toggle at bottom of profile: unsubscribe from all email notifications */
export function UnsubscribeEmailCard({
  receiveEmail: initialReceiveEmail,
}: UnsubscribeEmailCardProps) {
  const router = useRouter();
  const [receiveEmail, setReceiveEmail] = useState(initialReceiveEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReceiveEmail(initialReceiveEmail);
  }, [initialReceiveEmail]);

  async function handleChange(checked: boolean) {
    const wantReceive = !checked;
    setReceiveEmail(wantReceive);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPreferences: { email: wantReceive },
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setReceiveEmail(initialReceiveEmail);
        setError(json.error?.message ?? "Failed to update.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setReceiveEmail(initialReceiveEmail);
      setError("Failed to update.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="unsubscribe-email">Unsubscribe from emails</Label>
          <p className="text-xs text-muted-foreground">
            Stop all payment reminders and updates by email
          </p>
        </div>
        {loading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            id="unsubscribe-email"
            checked={!receiveEmail}
            onCheckedChange={handleChange}
          />
        )}
      </div>
    </div>
  );
}
