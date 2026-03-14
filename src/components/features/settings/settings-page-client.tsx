"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PluginsSettingsTab } from "./plugins-settings-tab";

type SettingsCategory =
  | "general"
  | "email"
  | "telegram"
  | "security"
  | "cron"
  | "plugin"
  | "plugins";

interface SettingItem {
  key: string;
  category: SettingsCategory;
  label: string;
  description: string;
  isSecret: boolean;
  value: string;
  maskedValue: string;
  hasValue: boolean;
}

interface SettingsPageClientProps {
  settings: SettingItem[];
}

// display groups: combine small categories so each tab has a meaningful set of fields
type SettingsTabId = "general" | "notifications" | "security" | "plugins";

const tabs: Array<{
  id: SettingsTabId;
  label: string;
  description: string;
  categoryKeys: SettingsCategory[];
}> = [
  {
    id: "general",
    label: "General",
    description: "Public runtime values shared across the app.",
    categoryKeys: ["general"],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email (Resend) and Telegram bot configuration for reminders and follow-ups.",
    categoryKeys: ["email", "telegram"],
  },
  {
    id: "security",
    label: "Security & automation",
    description: "Secrets for confirmation links, Telegram account linking, and protected cron endpoints.",
    categoryKeys: ["security", "cron"],
  },
  {
    id: "plugins",
    label: "Plugins",
    description: "Installed plugins and their configuration.",
    categoryKeys: ["plugins"],
  },
];

export function SettingsPageClient({ settings }: SettingsPageClientProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [savingTab, setSavingTab] = useState<SettingsTabId | null>(null);
  const [testing, setTesting] = useState<"email" | "telegram" | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const groupedByTab = useMemo(
    () =>
      tabs.map((tab) => ({
        ...tab,
        settings: settings.filter((s) => tab.categoryKeys.includes(s.category)),
      })),
    [settings]
  );

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function saveTab(tabId: SettingsTabId) {
    setMessage(null);
    setSavingTab(tabId);

    try {
      const tab = tabs.find((t) => t.id === tabId);
      const tabSettings = tab
        ? settings
            .filter((s) => tab.categoryKeys.includes(s.category))
            .map((setting) => ({
              key: setting.key,
              value: values[setting.key] ?? null,
            }))
        : [];

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: tabSettings }),
      });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error?.message || "Failed to save settings.");
        setSavingTab(null);
        return;
      }

      const tabLabel = tabs.find((t) => t.id === tabId)?.label ?? tabId;
      setMessage(`${tabLabel} settings saved.`);
    } catch {
      setMessage("Failed to save settings.");
    } finally {
      setSavingTab(null);
    }
  }

  async function runTest(kind: "email" | "telegram") {
    setMessage(null);
    setTesting(kind);

    try {
      const response = await fetch(`/api/settings/test-${kind}`, { method: "POST" });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error?.message || `Failed to send ${kind} test.`);
        return;
      }

      setMessage(
        kind === "email"
          ? "Test email sent successfully."
          : "Test Telegram message sent successfully."
      );
    } catch {
      setMessage(`Failed to send ${kind} test.`);
    } finally {
      setTesting(null);
    }
  }

  async function registerWebhook() {
    setMessage(null);
    setWebhookLoading(true);
    try {
      const response = await fetch("/api/telegram/set-webhook", {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error?.message ?? "Failed to register webhook.");
        return;
      }

      setMessage(
        "Webhook registered. Telegram will now send updates (e.g. when users open your bot link) to this app."
      );
    } catch {
      setMessage("Failed to register webhook.");
    } finally {
      setWebhookLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Card className="border-border/70">
        <CardHeader>
          <Badge variant="outline" className="w-fit">
            <ShieldCheck className="size-3" />
            Database-backed config
          </Badge>
          <CardTitle className="text-3xl">App settings</CardTitle>
          <CardDescription className="max-w-2xl">
            Runtime configuration now lives inside the app instead of being scattered
            across env files. Update integrations here and run quick channel tests
            without leaving the dashboard.
          </CardDescription>
        </CardHeader>
      </Card>

      {message ? (
        <div className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <Tabs defaultValue="general" className="gap-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {groupedByTab.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {tab.id === "plugins" ? (
              <PluginsSettingsTab />
            ) : (
              <Card>
                <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>{tab.label}</CardTitle>
                    <CardDescription>{tab.description}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tab.id === "notifications" ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => runTest("email")}
                          disabled={testing === "email"}
                        >
                          {testing === "email" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                          Send test email
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => registerWebhook()}
                          disabled={webhookLoading}
                        >
                          {webhookLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          Register webhook
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => runTest("telegram")}
                          disabled={testing === "telegram"}
                        >
                          {testing === "telegram" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                          Send test Telegram
                        </Button>
                      </>
                    ) : null}
                    <Button
                      onClick={() => saveTab(tab.id)}
                      disabled={savingTab === tab.id}
                    >
                      {savingTab === tab.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      Save {tab.label}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {tab.settings.map((setting) => (
                    <div
                      key={setting.key}
                      className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[220px_1fr_auto]"
                    >
                      <div>
                        <Label htmlFor={setting.key}>{setting.label}</Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                      <Input
                        id={setting.key}
                        type={
                          setting.isSecret && !revealed[setting.key]
                            ? "password"
                            : "text"
                        }
                        value={values[setting.key] ?? ""}
                        placeholder={setting.isSecret ? setting.maskedValue : ""}
                        onChange={(event) =>
                          updateValue(setting.key, event.target.value)
                        }
                      />
                      {setting.isSecret ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setRevealed((current) => ({
                              ...current,
                              [setting.key]: !current[setting.key],
                            }))
                          }
                        >
                          {revealed[setting.key] ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                          {revealed[setting.key] ? "Hide" : "Reveal"}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
