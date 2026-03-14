import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  getRegistryPathForCLI,
  getPluginsDirForCLI,
  loadPlugins,
  type RegistryEntry,
} from "@/lib/plugins/loader";
import { validatePluginManifest } from "@/lib/plugins/manifest";

function readRegistry(): RegistryEntry[] {
  const registryPath = getRegistryPathForCLI();
  try {
    const raw = fs.readFileSync(registryPath, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeRegistry(entries: RegistryEntry[]): void {
  const registryPath = getRegistryPathForCLI();
  const dir = path.dirname(registryPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    registryPath,
    JSON.stringify(entries, null, 2),
    "utf-8"
  );
}

function parseRepo(repo: string): { url: string; slug: string } {
  const trimmed = repo.trim();
  if (trimmed.includes("/") && !trimmed.startsWith("http")) {
    const parts = trimmed.split("/").filter(Boolean);
    const slug = parts[parts.length - 1].replace(/^substrack-plugin-/, "");
    return {
      url: `https://github.com/${trimmed}.git`,
      slug: slug || "plugin",
    };
  }
  if (trimmed.startsWith("https://github.com/")) {
    const match = trimmed.match(/github\.com\/[^/]+\/([^/]+?)(?:\.git)?\/?$/);
    const slug = match
      ? match[1].replace(/^substrack-plugin-/, "")
      : "plugin";
    return { url: trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`, slug };
  }
  return { url: `https://github.com/${trimmed}.git`, slug: trimmed };
}

export async function runPluginAddCommand(repo: string): Promise<void> {
  const pluginsDir = getPluginsDirForCLI();
  const registry = readRegistry();

  const { url, slug } = parseRepo(repo);
  const pluginDir = path.join(pluginsDir, slug);

  if (registry.some((e) => e.slug === slug)) {
    console.error(`Plugin "${slug}" is already installed.`);
    process.exit(1);
  }

  if (fs.existsSync(pluginDir)) {
    console.error(`Directory already exists: ${pluginDir}`);
    process.exit(1);
  }

  console.log(`Cloning ${url} into ${pluginDir}...`);
  try {
    execSync(`git clone --depth 1 "${url}" "${pluginDir}"`, {
      stdio: "inherit",
    });
  } catch {
    console.error("Clone failed. Check the repo URL and network.");
    process.exit(1);
  }

  const manifestPath = path.join(pluginDir, "substrack-plugin.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(
      `No substrack-plugin.json found in ${pluginDir}. Not a valid SubsTrack plugin.`
    );
    fs.rmSync(pluginDir, { recursive: true });
    process.exit(1);
  }

  const raw = fs.readFileSync(manifestPath, "utf-8");
  const result = validatePluginManifest(JSON.parse(raw));
  if (!result.success) {
    console.error(`Invalid manifest: ${result.error}`);
    fs.rmSync(pluginDir, { recursive: true });
    process.exit(1);
  }

  registry.push({ slug, path: `plugins/${slug}` });
  writeRegistry(registry);
  console.log(`Installed plugin "${slug}" (${result.manifest.name}).`);
  console.log("Configure it from the dashboard Settings → Plugins.");
}

export async function runPluginRemoveCommand(slug: string): Promise<void> {
  const pluginsDir = getPluginsDirForCLI();
  const registry = readRegistry();
  const entry = registry.find((e) => e.slug === slug);
  if (!entry) {
    console.error(`Plugin "${slug}" is not installed.`);
    process.exit(1);
  }

  const pluginDir = path.isAbsolute(entry.path)
    ? entry.path
    : path.join(process.cwd(), entry.path);
  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true });
  }

  writeRegistry(registry.filter((e) => e.slug !== slug));
  console.log(`Removed plugin "${slug}".`);
}

export async function runPluginListCommand(): Promise<void> {
  const plugins = loadPlugins();
  if (plugins.length === 0) {
    console.log("No plugins installed.");
    return;
  }
  console.log("Installed plugins:\n");
  for (const p of plugins) {
    const status = p.error ? ` (error: ${p.error})` : "";
    console.log(`  ${p.slug}  ${p.manifest.name}@${p.manifest.version}${status}`);
    if (p.manifest.description) {
      console.log(`      ${p.manifest.description}`);
    }
  }
}
