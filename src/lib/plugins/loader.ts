import fs from "fs";
import path from "path";
import {
  validatePluginManifest,
  type PluginManifest,
  type PluginTemplateEntry,
  type PluginChannelEntry,
} from "./manifest";

export interface RegistryEntry {
  slug: string;
  path: string;
}

export interface LoadedPlugin {
  slug: string;
  dir: string;
  manifest: PluginManifest;
  error?: string;
}

export interface PluginTemplateRegistration {
  pluginSlug: string;
  id: string;
  name: string;
  description?: string;
  entry: PluginTemplateEntry;
  resolvedFile: string;
}

export interface PluginChannelRegistration {
  pluginSlug: string;
  id: string;
  name: string;
  configSchema?: Record<string, { type: string; required?: boolean; label?: string }>;
  entry: PluginChannelEntry;
  resolvedFile: string;
}

const REGISTRY_FILENAME = "registry.json";
const MANIFEST_FILENAME = "substrack-plugin.json";

function getPluginsDir(): string {
  return path.join(process.cwd(), "plugins");
}

function getRegistryPath(): string {
  return path.join(getPluginsDir(), REGISTRY_FILENAME);
}

function readRegistry(): RegistryEntry[] {
  const registryPath = getRegistryPath();
  try {
    const raw = fs.readFileSync(registryPath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e: unknown): e is RegistryEntry =>
        typeof e === "object" &&
        e !== null &&
        "slug" in e &&
        "path" in e &&
        typeof (e as RegistryEntry).slug === "string" &&
        typeof (e as RegistryEntry).path === "string"
    );
  } catch {
    return [];
  }
}

function loadManifest(pluginDir: string): PluginManifest | null {
  const manifestPath = path.join(pluginDir, MANIFEST_FILENAME);
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const data = JSON.parse(raw);
    const result = validatePluginManifest(data);
    return result.success ? result.manifest : null;
  } catch {
    return null;
  }
}

export function loadPlugins(): LoadedPlugin[] {
  const pluginsDir = getPluginsDir();
  if (!fs.existsSync(pluginsDir)) return [];

  const registry = readRegistry();
  const loaded: LoadedPlugin[] = [];

  for (const entry of registry) {
    const pluginDir = path.isAbsolute(entry.path)
      ? entry.path
      : path.join(process.cwd(), entry.path);
    if (!fs.existsSync(pluginDir)) {
      loaded.push({
        slug: entry.slug,
        dir: pluginDir,
        manifest: { name: entry.slug, version: "0.0.0" },
        error: "Plugin directory not found",
      });
      continue;
    }

    const manifest = loadManifest(pluginDir);
    if (!manifest) {
      loaded.push({
        slug: entry.slug,
        dir: pluginDir,
        manifest: { name: entry.slug, version: "0.0.0" },
        error: "Invalid or missing manifest",
      });
      continue;
    }

    loaded.push({ slug: entry.slug, dir: pluginDir, manifest });
  }

  return loaded;
}

export function getPluginTemplates(): PluginTemplateRegistration[] {
  const plugins = loadPlugins();
  const out: PluginTemplateRegistration[] = [];

  for (const plugin of plugins) {
    if (plugin.error || !plugin.manifest.templates) continue;
    const templateIds =
      plugin.manifest.provides?.templates ??
      Object.keys(plugin.manifest.templates);
    for (const id of templateIds) {
      const entry = plugin.manifest.templates[id];
      if (!entry) continue;
      const resolvedFile = path.resolve(plugin.dir, entry.file);
      out.push({
        pluginSlug: plugin.slug,
        id,
        name: entry.name,
        description: entry.description,
        entry,
        resolvedFile,
      });
    }
  }

  return out;
}

export function getPluginChannels(): PluginChannelRegistration[] {
  const plugins = loadPlugins();
  const out: PluginChannelRegistration[] = [];

  for (const plugin of plugins) {
    if (plugin.error || !plugin.manifest.channels) continue;
    const channelIds =
      plugin.manifest.provides?.channels ?? Object.keys(plugin.manifest.channels);
    for (const id of channelIds) {
      const entry = plugin.manifest.channels[id];
      if (!entry) continue;
      const resolvedFile = path.resolve(plugin.dir, entry.file);
      out.push({
        pluginSlug: plugin.slug,
        id,
        name: entry.name,
        configSchema: entry.configSchema,
        entry,
        resolvedFile,
      });
    }
  }

  return out;
}

export function getRegistryPathForCLI(): string {
  return getRegistryPath();
}

export function getPluginsDirForCLI(): string {
  return getPluginsDir();
}
