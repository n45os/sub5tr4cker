import * as p from "@clack/prompts";
import { readConfig, updateConfig, getDbPath } from "@/lib/config/manager";

/**
 * s54r migrate — export data from SQLite, import into MongoDB, switch config mode.
 * Used to upgrade from local mode to advanced mode.
 */
export async function runMigrateCommand(): Promise<void> {
  p.intro("  sub5tr4cker — migrate to advanced mode  ");

  const config = readConfig();
  if (!config) {
    p.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }
  if (config.mode === "advanced") {
    p.log.warn("Already running in advanced mode.");
    process.exit(0);
  }

  p.note(
    "This will:\n" +
    "1. Export all your local data from SQLite\n" +
    "2. Import it into a MongoDB database\n" +
    "3. Switch your config to advanced mode\n\n" +
    "Your SQLite database will NOT be deleted.",
    "What will happen"
  );

  const mongoUri = await p.text({
    message: "MongoDB connection string",
    placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/sub5tr4cker",
    validate: (v) =>
      (v ?? "").startsWith("mongodb")
        ? undefined
        : "Must start with mongodb:// or mongodb+srv://",
  });
  if (p.isCancel(mongoUri)) { p.cancel("Migration cancelled."); process.exit(0); }

  const confirm = await p.confirm({
    message: `Ready to migrate to ${mongoUri}. Continue?`,
    initialValue: false,
  });
  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Migration cancelled.");
    process.exit(0);
  }

  // phase 1: export from sqlite
  const s = p.spinner();
  s.start("Exporting from SQLite...");
  process.env.SUB5TR4CKER_MODE = "local";
  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();

  const { getAdapter, resetAdapter, setAdapter } = await import("@/lib/storage");
  const { SqliteAdapter } = await import("@/lib/storage/sqlite-adapter");
  const { MongooseAdapter } = await import("@/lib/storage/mongoose-adapter");

  resetAdapter();
  const sqliteAdapter = new SqliteAdapter(getDbPath());
  await sqliteAdapter.initialize();
  setAdapter(sqliteAdapter);

  const bundle = await sqliteAdapter.exportAll();
  s.stop(`Exported ${bundle.data.groups.length} groups, ${bundle.data.billingPeriods.length} periods.`);

  // phase 2: import into MongoDB
  s.start("Importing into MongoDB...");
  process.env.MONGODB_URI = mongoUri as string;
  process.env.SUB5TR4CKER_MODE = "advanced";

  resetAdapter();
  const mongoAdapter = new MongooseAdapter();
  await mongoAdapter.initialize();
  setAdapter(mongoAdapter);

  const result = await mongoAdapter.importAll(bundle);
  await mongoAdapter.close();
  s.stop("Import complete.");

  if (result.errors.length > 0) {
    p.log.warn(`${result.errors.length} import error(s):`);
    result.errors.slice(0, 5).forEach((e) => p.log.warn(`  - ${e}`));
  }

  // phase 3: update config to advanced mode
  updateConfig({
    mode: "advanced",
    mongodb: { uri: mongoUri as string },
  });

  await sqliteAdapter.close();

  p.note(
    [
      `Groups migrated        : ${result.groups}`,
      `Billing periods        : ${result.billingPeriods}`,
      `Notifications          : ${result.notifications}`,
      `Price history          : ${result.priceHistory}`,
      "",
      "Next step: add your MONGODB_URI to .env.local and restart the server.",
    ].join("\n"),
    "Migration complete"
  );

  p.outro("Migration successful. You are now in advanced mode.");
}
