import { db } from "@/lib/storage";

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
  const store = await db();
  await store.ensureAppSettingsSeeded();
}
