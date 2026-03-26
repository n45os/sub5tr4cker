import fs from "fs";
import path from "path";
import { sub5tr4ckerConfigSchema, type Sub5tr4ckerConfig } from "./schema";

// ── data directory ────────────────────────────────────────────────────────────

export function getDataDir(): string {
  // allow override via env var (used in tests and custom install paths)
  if (process.env.SUB5TR4CKER_DATA_PATH) {
    return path.dirname(process.env.SUB5TR4CKER_DATA_PATH);
  }
  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  return path.join(home, ".sub5tr4cker");
}

export function getConfigPath(): string {
  return path.join(getDataDir(), "config.json");
}

export function getDbPath(): string {
  if (process.env.SUB5TR4CKER_DATA_PATH) {
    return process.env.SUB5TR4CKER_DATA_PATH;
  }
  return path.join(getDataDir(), "data.db");
}

// ── read / write ──────────────────────────────────────────────────────────────

let _cachedConfig: Sub5tr4ckerConfig | null = null;

/** read and validate config from disk; returns null if not initialized */
export function readConfig(): Sub5tr4ckerConfig | null {
  if (_cachedConfig) return _cachedConfig;

  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const parsed = sub5tr4ckerConfigSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[config] invalid config.json:", parsed.error.flatten());
      return null;
    }
    _cachedConfig = parsed.data;
    return _cachedConfig;
  } catch (e) {
    console.error("[config] failed to read config.json:", e);
    return null;
  }
}

/** write config to disk, creating the data directory if needed */
export function writeConfig(config: Sub5tr4ckerConfig): void {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    // restrict permissions on the data directory
    try { fs.chmodSync(dir, 0o700); } catch { /* ignore on Windows */ }
  }

  const configPath = getConfigPath();
  // write with restricted permissions (owner-only read/write)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  _cachedConfig = config;
}

/** merge partial updates into the current config and write to disk */
export function updateConfig(updates: Partial<Sub5tr4ckerConfig>): Sub5tr4ckerConfig {
  const current = readConfig();
  if (!current) throw new Error("Config not initialized. Run 's54r init' first.");
  const merged = { ...current, ...updates };
  const parsed = sub5tr4ckerConfigSchema.parse(merged);
  writeConfig(parsed);
  return parsed;
}

/** invalidate the in-memory cache (used after external writes or in tests) */
export function clearConfigCache(): void {
  _cachedConfig = null;
}

// ── mode detection ────────────────────────────────────────────────────────────

/**
 * Returns the current app mode.
 * Priority: SUB5TR4CKER_MODE env var → config.json → "advanced" (default for existing installs)
 */
export function getAppMode(): "local" | "advanced" {
  if (process.env.SUB5TR4CKER_MODE === "local") return "local";
  if (process.env.SUB5TR4CKER_MODE === "advanced") return "advanced";

  // check config file
  const config = readConfig();
  if (config) return config.mode;

  // default: advanced (existing MongoDB mode for users who haven't run s54r init)
  return "advanced";
}

/** returns true when running in local single-user mode */
export function isLocalMode(): boolean {
  return getAppMode() === "local";
}

// ── setting access ────────────────────────────────────────────────────────────

/**
 * Get a single setting value from local config.
 * Maps settings service keys (e.g. "email.apiKey") to config fields.
 */
export function getLocalSetting(key: string): string | null {
  const config = readConfig();
  if (!config) return null;

  switch (key) {
    case "email.apiKey":
      return config.notifications.channels.email?.apiKey ?? null;
    case "email.fromAddress":
      return config.notifications.channels.email?.fromAddress ?? null;
    case "email.replyToAddress":
      return config.notifications.channels.email?.replyToAddress ?? null;
    case "telegram.botToken":
      return config.notifications.channels.telegram?.botToken ?? null;
    case "telegram.webhookSecret":
      // no webhook in local mode
      return null;
    case "general.appUrl":
      return `http://localhost:${config.port}`;
    case "general.appName":
      return "sub5tr4cker";
    case "security.nextAuthSecret":
    case "security.authSecret":
      // use auth token as the secret in local mode
      return config.authToken ?? null;
    default:
      return null;
  }
}

/**
 * Set a single setting value in local config.
 * Used by the settings UI when in local mode.
 */
export function setLocalSetting(key: string, value: string | null): void {
  const config = readConfig();
  if (!config) throw new Error("Config not initialized");

  switch (key) {
    case "email.apiKey":
      updateConfig({
        notifications: {
          ...config.notifications,
          channels: {
            ...config.notifications.channels,
            email: config.notifications.channels.email
              ? { ...config.notifications.channels.email, apiKey: value ?? "" }
              : { provider: "resend", apiKey: value ?? "", fromAddress: "" },
          },
        },
      });
      break;
    case "email.fromAddress":
      updateConfig({
        notifications: {
          ...config.notifications,
          channels: {
            ...config.notifications.channels,
            email: config.notifications.channels.email
              ? { ...config.notifications.channels.email, fromAddress: value ?? "" }
              : { provider: "resend", apiKey: "", fromAddress: value ?? "" },
          },
        },
      });
      break;
    case "telegram.botToken":
      updateConfig({
        notifications: {
          ...config.notifications,
          channels: {
            ...config.notifications.channels,
            telegram: config.notifications.channels.telegram
              ? { ...config.notifications.channels.telegram, botToken: value ?? "" }
              : { botToken: value ?? "", pollingEnabled: true },
          },
        },
      });
      break;
    default:
      // unknown keys are silently ignored in local mode
      break;
  }
}
