import crypto from "crypto";
import { dbConnect } from "@/lib/db/mongoose";
import { Settings } from "@/models";
import {
  getSettingsDefinition,
  settingsDefinitions,
  type SettingsCategory,
} from "@/lib/settings/definitions";
import { ensureSettingsMigrated } from "@/lib/settings/migrate";

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  value: string | null;
  expiresAt: number;
};

const settingsCache = new Map<string, CacheEntry>();

function getEncryptionKey() {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "dev-secret-change-in-production";

  return crypto.createHash("sha256").update(secret).digest();
}

function encryptValue(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptValue(value: string | null) {
  if (!value) {
    return null;
  }

  if (!value.startsWith("enc:")) {
    return value;
  }

  const [, iv, tag, encrypted] = value.split(":");
  if (!iv || !tag || !encrypted) {
    return value;
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("failed to decrypt setting value:", error);
    return null;
  }
}

function resolveFallbackValue(key: string) {
  const definition = getSettingsDefinition(key);
  if (!definition) {
    return null;
  }

  return process.env[definition.envVar] ?? definition.defaultValue ?? null;
}

export function clearSettingsCache(key?: string) {
  if (key) {
    settingsCache.delete(key);
    return;
  }

  settingsCache.clear();
}

export function maskSettingValue(value: string | null) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "••••••••";
  }

  return `${value.slice(0, 3)}••••${value.slice(-3)}`;
}

export async function getSetting(key: string): Promise<string | null> {
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  await ensureSettingsMigrated();
  await dbConnect();

  const definition = getSettingsDefinition(key);
  const record = await Settings.findOne({ key }).lean().exec();
  const rawValue = record?.value ?? resolveFallbackValue(key);
  const value =
    definition?.isSecret && rawValue?.startsWith("enc:")
      ? decryptValue(rawValue)
      : rawValue;

  settingsCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return value;
}

export async function getAllSettings(category?: SettingsCategory) {
  await ensureSettingsMigrated();
  await dbConnect();

  const query = category ? { category } : {};
  const records = await Settings.find(query).lean().sort({ category: 1, key: 1 }).exec();
  const recordMap = new Map(records.map((record) => [record.key, record]));

  return settingsDefinitions
    .filter((definition) => !category || definition.category === category)
    .map((definition) => {
      const record = recordMap.get(definition.key);
      const storedValue = record?.value ?? resolveFallbackValue(definition.key);
      const value =
        definition.isSecret && storedValue?.startsWith("enc:")
          ? decryptValue(storedValue)
          : storedValue;

      return {
        key: definition.key,
        category: definition.category,
        label: definition.label,
        description: definition.description,
        isSecret: definition.isSecret,
        envVar: definition.envVar,
        value: value ?? "",
        maskedValue: definition.isSecret ? maskSettingValue(value) : value ?? "",
        hasValue: !!value,
      };
    });
}

const PLUGIN_KEY_REGEX = /^plugin\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;

export async function setSetting(key: string, value: string | null) {
  const definition = getSettingsDefinition(key);
  const isPluginKey = PLUGIN_KEY_REGEX.test(key);
  if (!definition && !isPluginKey) {
    throw new Error(`Unknown setting key: ${key}`);
  }

  await ensureSettingsMigrated();
  await dbConnect();

  const effectiveDef = definition ?? {
    category: "plugin" as const,
    isSecret: false,
    label: key,
    description: "Plugin setting",
  };
  const nextValue =
    value && effectiveDef.isSecret ? encryptValue(value) : value ?? null;

  await Settings.findOneAndUpdate(
    { key },
    {
      key,
      value: nextValue,
      category: effectiveDef.category,
      isSecret: effectiveDef.isSecret,
      label: effectiveDef.label,
      description: effectiveDef.description,
    },
    { upsert: true, new: true }
  );

  clearSettingsCache(key);
}
