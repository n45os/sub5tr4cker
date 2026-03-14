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

type SettingsCategory =
  | "general"
  | "email"
  | "telegram"
  | "security"
  | "cron";

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

const categories: Array<{
  key: SettingsCategory;
  label: string;
  description: string;
}> = [
  {
    key: "general",
    label: "General",
    description: "Public runtime values shared across the app.",
  },
  {
    key: "email",
    label: "Email",
    description: "Resend credentials and sender configuration.",
  },
  {
    key: "telegram",
    label: "Telegram",
    description: "Bot delivery settings for reminders and follow-ups.",
  },
  {
    key: "security",
    label: "Security",
    description: "Secrets used for tokens and protected routes.",
  },
  {
    key: "cron",
    label: "Cron",
    description: "Scheduled job configuration and secrets.",
  },
];

export function SettingsPageClient({ settings }: SettingsPageClientProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [savingCategory, setSavingCategory] = useState<SettingsCategory | null>(
    null
  );
  const [testing, setTesting] = useState<"email" | "telegram" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const groupedSettings = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        settings: settings.filter((setting) => setting.category === category.key),
      })),
    [settings]
  );

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function saveCategory(category: SettingsCategory) {
    setMessage(null);
    setSavingCategory(category);

    try {
      const categorySettings = settings
        .filter((setting) => setting.category === category)
        .map((setting) => ({
          key: setting.key,
          value: values[setting.key] || null,
        }));

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: categorySettings }),
      });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error?.message || "Failed to save settings.");
        setSavingCategory(null);
        return;
      }

      setMessage(`${category.charAt(0).toUpperCase() + category.slice(1)} settings saved.`);
    } catch {
      setMessage("Failed to save settings.");
    } finally {
      setSavingCategory(null);
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
          {categories.map((category) => (
            <TabsTrigger key={category.key} value={category.key}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {groupedSettings.map((category) => (
          <TabsContent key={category.key} value={category.key}>
            <Card>
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>{category.label}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {category.key === "email" ? (
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
                  ) : null}
                  {category.key === "telegram" ? (
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
                  ) : null}
                  <Button
                    onClick={() => saveCategory(category.key)}
                    disabled={savingCategory === category.key}
                  >
                    {savingCategory === category.key ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Save {category.label}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                {category.settings.map((setting) => (
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
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
