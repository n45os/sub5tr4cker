import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import { readConfig, getDbPath, getDataDir } from "@/lib/config/manager";

export async function runExportCommand(options: { output?: string } = {}): Promise<void> {
  process.env.SUB5TR4CKER_MODE = "local";

  const config = readConfig();
  if (!config) {
    p.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }
  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();

  const s = p.spinner();
  s.start("Exporting data...");

  const { getAdapter, resetAdapter } = await import("@/lib/storage");
  resetAdapter();
  const adapter = getAdapter();
  await adapter.initialize();

  const bundle = await adapter.exportAll();
  await adapter.close();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = options.output ?? path.join(getDataDir(), `export-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf-8");
  s.stop(`Data exported to ${outputPath}`);

  p.note(
    [
      `Groups         : ${bundle.data.groups.length}`,
      `Billing periods: ${bundle.data.billingPeriods.length}`,
      `Notifications  : ${bundle.data.notifications.length}`,
      `Price history  : ${bundle.data.priceHistory.length}`,
    ].join("\n"),
    "Export summary"
  );

  p.outro(`Export complete: ${outputPath}`);
}

export async function runImportCommand(
  filePath: string,
  options: { dryRun?: boolean } = {}
): Promise<void> {
  process.env.SUB5TR4CKER_MODE = "local";

  if (!fs.existsSync(filePath)) {
    p.log.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  p.intro("  sub5tr4cker — import data  ");

  let bundle: unknown;
  try {
    bundle = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    p.log.error(`Failed to parse export file: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  const exportBundle = bundle as { version: string; data: { groups: unknown[]; billingPeriods: unknown[] } };
  p.note(
    [
      `File           : ${filePath}`,
      `Schema version : ${exportBundle.version ?? "unknown"}`,
      `Groups         : ${exportBundle.data?.groups?.length ?? 0}`,
      `Billing periods: ${exportBundle.data?.billingPeriods?.length ?? 0}`,
    ].join("\n"),
    "Import preview"
  );

  if (options.dryRun) {
    p.outro("Dry run — no data was written.");
    return;
  }

  const confirm = await p.confirm({
    message: "Proceed with import? Existing records with the same ID will be skipped.",
    initialValue: true,
  });
  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Import cancelled.");
    process.exit(0);
  }

  const config = readConfig();
  if (!config) {
    p.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }
  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();

  const s = p.spinner();
  s.start("Importing data...");

  const { getAdapter, resetAdapter } = await import("@/lib/storage");
  resetAdapter();
  const adapter = getAdapter();
  await adapter.initialize();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await adapter.importAll(bundle as any);
  await adapter.close();
  s.stop("Import complete.");

  if (result.errors.length > 0) {
    p.log.warn(`${result.errors.length} error(s) during import:`);
    result.errors.slice(0, 10).forEach((e) => p.log.warn(`  - ${e}`));
    if (result.errors.length > 10) p.log.warn(`  ... and ${result.errors.length - 10} more`);
  }

  p.note(
    [
      `Groups imported        : ${result.groups}`,
      `Billing periods        : ${result.billingPeriods}`,
      `Notifications          : ${result.notifications}`,
      `Price history entries  : ${result.priceHistory}`,
    ].join("\n"),
    "Import results"
  );

  p.outro("Import complete.");
}
