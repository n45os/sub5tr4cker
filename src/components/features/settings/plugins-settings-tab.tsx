"use client";

import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
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

interface PluginConfigKey {
  key: string;
  label?: string;
  type: string;
}

interface PluginItem {
  slug: string;
  name: string;
  version: string;
  description: string | null;
  error: string | null;
  configKeys: PluginConfigKey[];
}

interface PluginsData {
  plugins: PluginItem[];
  configValues: Record<string, string>;
}

export function PluginsSettingsTab() {
  const [data, setData] = useState<PluginsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPlugins() {
      try {
        const res = await fetch("/api/plugins");
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const payload = json.data ?? { plugins: [], configValues: {} };
        setData(payload);
        setValues(payload.configValues ?? {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPlugins();
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePluginConfig(slug: string, configKeys: PluginConfigKey[]) {
    if (!configKeys.length) return;
    setMessage(null);
    setSaving(true);
    try {
      const settings = configKeys.map((c) => ({
        key: c.key,
        value: values[c.key] ?? null,
      }));
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error?.message ?? "Failed to save.");
        return;
      }
      setMessage("Plugin settings saved.");
    } catch {
      setMessage("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const plugins = data?.plugins ?? [];
  if (plugins.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plugins</CardTitle>
          <CardDescription>
            Install plugins from GitHub to add notification templates and channels
            (e.g. Slack). Run <code className="rounded bg-muted px-1.5 py-0.5 text-sm">pnpm substrack plugin add owner/repo</code> in the project root, then restart the app.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}
      {plugins.map((plugin) => (
        <Card key={plugin.slug}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-4" />
                  {plugin.name}
                </CardTitle>
                <Badge variant="secondary">v{plugin.version}</Badge>
                {plugin.error ? (
                  <Badge variant="destructive">{plugin.error}</Badge>
                ) : null}
              </div>
              {plugin.description ? (
                <CardDescription className="mt-1">
                  {plugin.description}
                </CardDescription>
              ) : null}
            </div>
            {plugin.configKeys.length > 0 ? (
              <Button
                onClick={() => savePluginConfig(plugin.slug, plugin.configKeys)}
                disabled={saving}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save
              </Button>
            ) : null}
          </CardHeader>
          {plugin.configKeys.length > 0 ? (
            <CardContent className="grid gap-4">
              {plugin.configKeys.map((configKey) => (
                <div
                  key={configKey.key}
                  className="grid gap-2 rounded-xl border p-4"
                >
                  <Label htmlFor={configKey.key}>
                    {configKey.label ?? configKey.key}
                  </Label>
                  <Input
                    id={configKey.key}
                    type={configKey.type === "number" ? "number" : "text"}
                    value={values[configKey.key] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [configKey.key]: e.target.value,
                      }))
                    }
                    placeholder={`plugin.${plugin.slug}.${configKey.key.split(".").pop()}`}
                  />
                </div>
              ))}
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
