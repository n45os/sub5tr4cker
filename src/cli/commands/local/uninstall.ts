import * as p from "@clack/prompts";
import os from "os";
import { execSync } from "child_process";
import fs from "fs";
import { readConfig, getDataDir, getConfigPath } from "@/lib/config/manager";
import { runExportCommand } from "./export-import";

export async function runUninstallCommand(): Promise<void> {
  p.intro("  sub5tr4cker — uninstall  ");

  const config = readConfig();

  // step 1: offer backup
  const wantsBackup = await p.confirm({
    message: "Would you like to export your data before uninstalling?",
    initialValue: true,
  });
  if (p.isCancel(wantsBackup)) { p.cancel("Cancelled."); process.exit(0); }

  if (wantsBackup) {
    const backupPath = `${os.homedir()}/sub5tr4cker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    await runExportCommand({ output: backupPath });
    p.log.success(`Backup saved to ${backupPath}`);
  }

  // step 2: confirm deletion
  const dataDir = getDataDir();
  const confirm = await p.confirm({
    message: `This will permanently delete:\n  - ${dataDir}/\n  - Cron job entries\n\nAre you sure?`,
    initialValue: false,
  });
  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Uninstall cancelled. Nothing was deleted.");
    process.exit(0);
  }

  const s = p.spinner();
  s.start("Removing cron job...");

  // remove cron entries
  if (config?.cron?.installed) {
    try {
      if (config.cron.method === "launchd") {
        const plistPath = `${os.homedir()}/Library/LaunchAgents/com.sub5tr4cker.notify.plist`;
        try { execSync(`launchctl unload ${plistPath} 2>/dev/null`); } catch { /* ignore */ }
        if (fs.existsSync(plistPath)) fs.rmSync(plistPath);
      } else if (config.cron.method === "crontab") {
        // remove s54r notify lines from crontab
        try {
          const existing = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
          const filtered = existing
            .split("\n")
            .filter((l) => !l.includes("s54r notify") && !l.includes("substrack notify"))
            .join("\n");
          const tmp = `/tmp/sub5tr4cker-remove-${Date.now()}`;
          fs.writeFileSync(tmp, filtered);
          execSync(`crontab ${tmp}`);
          fs.rmSync(tmp);
        } catch { /* ignore if no crontab */ }
      }
    } catch (e) {
      p.log.warn(`Could not remove cron job: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  s.stop("Cron job removed.");

  // step 3: delete data directory
  s.start(`Deleting ${dataDir}...`);
  try {
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
    s.stop("Data directory deleted.");
  } catch (e) {
    s.stop("Warning: could not fully delete data directory.");
    p.log.warn(`Error: ${e instanceof Error ? e.message : String(e)}`);
    p.log.warn(`You may need to manually delete: ${dataDir}`);
  }

  // check if the config file is in a different location
  if (fs.existsSync(getConfigPath())) {
    try { fs.rmSync(getConfigPath()); } catch { /* ignore */ }
  }

  p.note(
    [
      "sub5tr4cker has been uninstalled.",
      "",
      "To fully remove the npm package:",
      "  npm uninstall -g sub5tr4cker",
      "  # or",
      "  pnpm remove -g sub5tr4cker",
    ].join("\n"),
    "Uninstall complete"
  );

  p.outro("Goodbye!");
}
