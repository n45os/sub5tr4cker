"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
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
  | "notifications"
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

type SettingsTabId = "general" | "security" | "plugins";

const tabs: Array<{
  id: SettingsTabId;
  label: string;
  description: string;
  categoryKeys: SettingsCategory[];
}> = [
  {
    id: "general",
    label: "General",
    description:
      "Workspace-wide basics like the public app URL and other shared runtime values.",
    categoryKeys: ["general"],
  },
  {
    id: "security",
    label: "Security & automation",
    description:
      "Secrets for confirmation links, Telegram account linking, and protected cron endpoints.",
    categoryKeys: ["security", "cron"],
  },
  {
    id: "plugins",
    label: "Plugins",
    description: "Optional extensions: enable, configure, or review installed plugins.",
    categoryKeys: ["plugins"],
  },
];

export function SettingsPageClient({ settings }: SettingsPageClientProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [savingTab, setSavingTab] = useState<SettingsTabId | null>(null);
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
      const tab = tabs.find((entry) => entry.id === tabId);
      const payload = tab
        ? settings
            .filter((setting) => tab.categoryKeys.includes(setting.category))
            .map((setting) => ({
              key: setting.key,
              value: values[setting.key] ?? null,
            }))
        : [];

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error?.message || "Failed to save settings.");
        return;
      }

      setMessage(`${tab?.label ?? tabId} settings saved.`);
    } catch {
      setMessage("Failed to save settings.");
    } finally {
      setSavingTab(null);
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
          <CardTitle className="text-3xl">Workspace settings</CardTitle>
          <CardDescription className="max-w-2xl">
            General app configuration, security secrets, cron access, and plugins now
            live in one dashboard surface. Notification channels moved to the
            notifications hub.
          </CardDescription>
        </CardHeader>
      </Card>

      {message ? (
        <div className="rounded-xl border border-border/70 px-4 py-3 text-sm text-muted-foreground">
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
              <Card className="border-border/70">
                <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>{tab.label}</CardTitle>
                    <CardDescription>{tab.description}</CardDescription>
                  </div>
                  <Button
                    onClick={() => saveTab(tab.id)}
                    disabled={savingTab === tab.id}
                  >
                    {savingTab === tab.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Save {tab.label}
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {tab.id === "security" ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">How these secrets work</p>
                      <ul className="mt-2 list-disc space-y-2 pl-5">
                        <li>
                          Confirmation token secret signs member-facing links so old
                          emails stop working if you rotate it.
                        </li>
                        <li>
                          Telegram link secret protects account-link URLs and falls back
                          to the confirmation secret when empty.
                        </li>
                        <li>
                          Cron secret is sent in the{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            x-cron-secret
                          </code>{" "}
                          header for protected scheduler routes.
                        </li>
                      </ul>
                    </div>
                  ) : null}

                  {tab.settings.map((setting) => (
                    <div
                      key={setting.key}
                      className="grid gap-3 rounded-2xl border border-border/70 p-4 lg:grid-cols-[220px_1fr_auto]"
                    >
                      <div>
                        <Label htmlFor={setting.key}>{setting.label}</Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                      <Input
                        id={setting.key}
                        type={setting.isSecret && !revealed[setting.key] ? "password" : "text"}
                        value={values[setting.key] ?? ""}
                        placeholder={setting.isSecret ? setting.maskedValue : ""}
                        onChange={(event) => updateValue(setting.key, event.target.value)}
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
