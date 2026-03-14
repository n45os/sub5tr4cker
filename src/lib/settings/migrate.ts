import { dbConnect } from "@/lib/db/mongoose";
import { Settings } from "@/models";
import { settingsDefinitions } from "@/lib/settings/definitions";

let migrationPromise: Promise<void> | null = null;

export async function ensureSettingsMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runSettingsMigration().finally(() => {
      migrationPromise = null;
    });
  }

  await migrationPromise;
}

async function runSettingsMigration() {
  await dbConnect();

  for (const definition of settingsDefinitions) {
    const existing = await Settings.findOne({ key: definition.key }).lean().exec();
    if (existing) {
      continue;
    }

    const envValue = process.env[definition.envVar];
    const value = envValue ?? definition.defaultValue ?? null;

    await Settings.create({
      key: definition.key,
      value,
      category: definition.category,
      isSecret: definition.isSecret,
      label: definition.label,
      description: definition.description,
    });
  }
}
