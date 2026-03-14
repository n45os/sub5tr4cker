import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isInstanceAdmin } from "@/lib/authorization";
import { loadPlugins, getPluginChannels } from "@/lib/plugins/loader";
import { getSetting } from "@/lib/settings/service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }
  if (!isInstanceAdmin(session)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only admins can view plugins" } },
      { status: 403 }
    );
  }

  const plugins = loadPlugins();
  const channelRegs = getPluginChannels();

  const list = plugins.map((p) => {
    const channels = channelRegs.filter((c) => c.pluginSlug === p.slug);
    const configKeys: Array<{ key: string; label?: string; type: string }> = [];
    for (const ch of channels) {
      if (ch.entry.configSchema) {
        for (const [k, v] of Object.entries(ch.entry.configSchema)) {
          configKeys.push({
            key: `plugin.${p.slug}.${k}`,
            label: v.label ?? k,
            type: v.type ?? "string",
          });
        }
      }
    }
    return {
      slug: p.slug,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description ?? null,
      error: p.error ?? null,
      configKeys,
    };
  });

  const configValues: Record<string, string> = {};
  for (const item of list) {
    for (const { key } of item.configKeys) {
      const value = await getSetting(key);
      if (value != null) configValues[key] = value;
    }
  }

  return NextResponse.json({
    data: { plugins: list, configValues },
  });
}
