"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReminderFrequency = "once" | "daily" | "every_3_days";

type NotificationPreferencesCardProps = {
  reminderFrequency: ReminderFrequency;
};

const FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  once: "Once per period",
  daily: "Daily",
  every_3_days: "Every 3 days",
};

export function NotificationPreferencesCard({
  reminderFrequency: initialReminderFrequency,
}: NotificationPreferencesCardProps) {
  const router = useRouter();
  const [reminderFrequency, setReminderFrequency] =
    useState<ReminderFrequency>(initialReminderFrequency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setReminderFrequency(initialReminderFrequency);
  }, [initialReminderFrequency]);

  const hasChanges = reminderFrequency !== initialReminderFrequency;

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPreferences: { reminderFrequency },
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "Failed to update preferences.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
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
      {success ? (
        <p className="text-sm text-green-600 dark:text-green-500">
          Preferences saved.
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="pref-frequency">Reminder frequency</Label>
        <Select
          value={reminderFrequency}
          onValueChange={(value) =>
            setReminderFrequency((value ?? reminderFrequency) as ReminderFrequency)
          }
        >
          <SelectTrigger id="pref-frequency" className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="once">{FREQUENCY_LABELS.once}</SelectItem>
            <SelectItem value="daily">{FREQUENCY_LABELS.daily}</SelectItem>
            <SelectItem value="every_3_days">
              {FREQUENCY_LABELS.every_3_days}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        onClick={handleSave}
        disabled={loading || !hasChanges}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Save preferences"
        )}
      </Button>
    </div>
  );
}
