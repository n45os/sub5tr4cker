"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface NotificationPreferenceState {
  remindersEnabled: boolean;
  followUpsEnabled: boolean;
  priceChangeEnabled: boolean;
}

interface RecentNotificationItem {
  _id: string;
  type: string;
  channel: string;
  status: string;
  subject: string | null;
  preview: string;
  recipientEmail: string;
  createdAt: string;
}

interface GroupNotificationsPanelProps {
  groupId: string;
  isAdmin: boolean;
  initialPreferences: NotificationPreferenceState;
  recentNotifications: RecentNotificationItem[];
}

export function GroupNotificationsPanel({
  groupId,
  isAdmin,
  initialPreferences,
  recentNotifications,
}: GroupNotificationsPanelProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function savePreferences() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error?.message || "Failed to save notification settings.");
        return;
      }

      setMessage("Notification settings saved.");
    } catch {
      setMessage("Failed to save notification settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardContent className="grid gap-4 p-6">
          <div>
            <h3 className="text-lg font-semibold">Enabled flows</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Control which automatic notifications can be sent for this group.
            </p>
          </div>

          {[
            {
              key: "remindersEnabled" as const,
              label: "Payment reminders",
              description: "Member reminders for unpaid billing periods.",
            },
            {
              key: "followUpsEnabled" as const,
              label: "Admin follow-ups",
              description: "Owner nudges when payments await verification.",
            },
            {
              key: "priceChangeEnabled" as const,
              label: "Price change announcements",
              description: "Alerts when the subscription price changes.",
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border p-4"
            >
              <div className="space-y-1">
                <Label htmlFor={item.key}>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                id={item.key}
                checked={preferences[item.key]}
                disabled={!isAdmin}
                onCheckedChange={(checked) =>
                  setPreferences((current) => ({
                    ...current,
                    [item.key]: checked,
                  }))
                }
              />
            </div>
          ))}

          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard/notifications" className="text-sm text-primary hover:underline">
              Open template center
            </Link>
            {isAdmin ? (
              <Button onClick={savePreferences} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save settings
              </Button>
            ) : null}
          </div>

          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-6">
          <div>
            <h3 className="text-lg font-semibold">Recent delivery log</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The latest notifications sent for this group across email and Telegram.
            </p>
          </div>

          {recentNotifications.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No notifications have been logged for this group yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {recentNotifications.map((notification) => (
                <div
                  key={notification._id}
                  className="rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {notification.type.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {notification.channel}
                    </Badge>
                    <Badge
                      variant={
                        notification.status === "sent" ? "default" : "destructive"
                      }
                      className="capitalize"
                    >
                      {notification.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    {notification.subject || notification.preview}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    To {notification.recipientEmail}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
