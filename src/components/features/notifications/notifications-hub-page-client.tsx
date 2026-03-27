"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Settings2,
  Webhook,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SettingsCategory = "email" | "telegram" | "notifications";

interface SettingItem {
  key: string;
  category: SettingsCategory | string;
  label: string;
  description: string;
  isSecret: boolean;
  value: string;
  maskedValue: string;
  hasValue: boolean;
}

interface TemplateItem {
  type: string;
  name: string;
  description: string;
  variables: string[];
  channels: Array<"email" | "telegram">;
}

interface NotificationsHubPageClientProps {
  settings: SettingItem[];
  templates: TemplateItem[];
}

interface WebhookInfoState {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

const EMAIL_KEYS = [
  "email.enabled",
  "email.apiKey",
  "email.fromAddress",
  "email.replyToAddress",
] as const;

const TELEGRAM_KEYS = [
  "telegram.enabled",
  "telegram.botToken",
  "telegram.webhookSecret",
] as const;

const DELIVERY_KEYS = ["notifications.aggregateReminders"] as const;

function getEnabledValue(value: string | undefined): boolean {
  return value !== "false";
}

export function NotificationsHubPageClient({
  settings,
  templates,
}: NotificationsHubPageClientProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<
    "email" | "telegram" | "delivery" | null
  >(null);
  const [testing, setTesting] = useState<"email" | "telegram" | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookInfoLoading, setWebhookInfoLoading] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfoState | null>(null);

  const settingsByKey = useMemo(
    () => new Map(settings.map((setting) => [setting.key, setting])),
    [settings]
  );

  const emailEnabled = getEnabledValue(values["email.enabled"]);
  const telegramEnabled = getEnabledValue(values["telegram.enabled"]);

  function getSetting(key: string) {
    return settingsByKey.get(key) ?? null;
  }

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(
    section: "email" | "telegram" | "delivery",
    keys: readonly string[],
    successMessage: string
  ) {
    setMessage(null);
    setSavingSection(section);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: keys.map((key) => ({
            key,
            value: values[key] ?? null,
          })),
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error?.message || "Failed to save settings.");
        return;
      }

      setMessage(successMessage);
    } catch {
      setMessage("Failed to save settings.");
    } finally {
      setSavingSection(null);
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

      setMessage("Telegram webhook registered.");
    } catch {
      setMessage("Failed to register webhook.");
    } finally {
      setWebhookLoading(false);
    }
  }

  async function checkWebhookStatus() {
    setMessage(null);
    setWebhookInfoLoading(true);
    try {
      const response = await fetch("/api/telegram/webhook-info", {
        method: "GET",
      });
      const json = await response.json();

      if (!response.ok) {
        setWebhookInfo(null);
        setMessage(json.error?.message ?? "Failed to fetch webhook info.");
        return;
      }

      setWebhookInfo(json.data ?? null);
      setMessage("Fetched Telegram webhook status.");
    } catch {
      setWebhookInfo(null);
      setMessage("Failed to fetch webhook info.");
    } finally {
      setWebhookInfoLoading(false);
    }
  }

  function renderSettingInput(settingKey: string, disabled = false) {
    const setting = getSetting(settingKey);
    if (!setting) {
      return null;
    }

    if (
      settingKey === "email.enabled" ||
      settingKey === "telegram.enabled" ||
      settingKey === "notifications.aggregateReminders"
    ) {
      const checked = getEnabledValue(values[settingKey]);
      return (
        <label
          key={setting.key}
          className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4"
        >
          <Checkbox
            checked={checked}
            onCheckedChange={(next) =>
              updateValue(setting.key, next ? "true" : "false")
            }
            disabled={disabled}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">{setting.label}</p>
            <p className="text-sm text-muted-foreground">{setting.description}</p>
          </div>
        </label>
      );
    }

    return (
      <div key={setting.key} className="grid gap-2">
        <Label htmlFor={setting.key}>{setting.label}</Label>
        <p className="text-sm text-muted-foreground">{setting.description}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={setting.key}
            type={setting.isSecret && !revealed[setting.key] ? "password" : "text"}
            value={values[setting.key] ?? ""}
            placeholder={setting.isSecret ? setting.maskedValue : ""}
            onChange={(event) => updateValue(setting.key, event.target.value)}
            disabled={disabled}
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
              disabled={disabled}
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
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="border-border/70">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit">
              Notifications hub
            </Badge>
            <div>
              <CardTitle className="text-3xl">Messages, channels, and delivery</CardTitle>
              <CardDescription className="max-w-3xl">
                Keep email setup, Telegram setup, templates, and delivery surfaces in
                one place so the workspace is easier to operate.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/activity"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <BellRing className="size-4" />
              Delivery log
            </Link>
            <Link
              href="/dashboard/scheduled-tasks"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <CheckCircle2 className="size-4" />
              Scheduled sends
            </Link>
            <Link
              href="/dashboard/settings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Settings2 className="size-4" />
              Workspace settings
            </Link>
          </div>
        </CardHeader>
      </Card>

      {message ? (
        <div className="rounded-xl border border-border/70 px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <CardTitle>Email</CardTitle>
            </div>
            <CardDescription>
              Configure Resend, sender details, and whether this workspace should use
              email at all.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {EMAIL_KEYS.map((key) =>
              renderSettingInput(key, key !== "email.enabled" && !emailEnabled)
            )}

            {!emailEnabled ? (
              <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Email is off for this workspace, so member email can be optional and
                email-only setup is hidden from the main flow.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => runTest("email")}
                disabled={!emailEnabled || testing === "email"}
              >
                {testing === "email" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send test email
              </Button>
              <Button
                onClick={() =>
                  saveSettings("email", EMAIL_KEYS, "Email settings saved.")
                }
                disabled={savingSection === "email"}
              >
                {savingSection === "email" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Save email
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-muted-foreground" />
              <CardTitle>Telegram</CardTitle>
            </div>
            <CardDescription>
              Configure your bot, webhook, and whether this workspace should use
              Telegram delivery.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {TELEGRAM_KEYS.map((key) =>
              renderSettingInput(key, key !== "telegram.enabled" && !telegramEnabled)
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => runTest("telegram")}
                disabled={!telegramEnabled || testing === "telegram"}
              >
                {testing === "telegram" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send test Telegram
              </Button>
              <Button
                variant="outline"
                onClick={() => registerWebhook()}
                disabled={!telegramEnabled || webhookLoading}
              >
                {webhookLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Webhook className="size-4" />
                )}
                Register webhook
              </Button>
              <Button
                variant="outline"
                onClick={() => checkWebhookStatus()}
                disabled={!telegramEnabled || webhookInfoLoading}
              >
                {webhookInfoLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Webhook className="size-4" />
                )}
                Check webhook
              </Button>
              <Button
                onClick={() =>
                  saveSettings("telegram", TELEGRAM_KEYS, "Telegram settings saved.")
                }
                disabled={savingSection === "telegram"}
              >
                {savingSection === "telegram" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Save Telegram
              </Button>
            </div>

            {webhookInfo ? (
              <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Webhook URL:</span>{" "}
                  {webhookInfo.url || "Not set"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Pending updates:</span>{" "}
                  {webhookInfo.pending_update_count}
                </p>
                <p>
                  <span className="font-medium text-foreground">Last error:</span>{" "}
                  {webhookInfo.last_error_message || "None"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Last error date:</span>{" "}
                  {webhookInfo.last_error_date
                    ? new Date(webhookInfo.last_error_date * 1000).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Reminder delivery behavior</CardTitle>
          <CardDescription>
            Control how automated reminders are bundled once the workspace channels
            are configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            {renderSettingInput("notifications.aggregateReminders")}
          </div>
          <Button
            onClick={() =>
              saveSettings("delivery", DELIVERY_KEYS, "Reminder delivery settings saved.")
            }
            disabled={savingSection === "delivery"}
          >
            {savingSection === "delivery" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Save delivery
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Preview the exact email and Telegram messages used by reminders, invites,
            confirmations, and price updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          {templates.map((template) => (
            <Link
              key={template.type}
              href={`/dashboard/notifications/${template.type}`}
              className="block"
            >
              <Card className="h-full border-border/70 transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex flex-wrap gap-2">
                    {template.channels.map((channel) => (
                      <Badge
                        key={channel}
                        variant="secondary"
                        className="capitalize"
                      >
                        {channel}
                      </Badge>
                    ))}
                  </div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Variables: {template.variables.join(", ")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
