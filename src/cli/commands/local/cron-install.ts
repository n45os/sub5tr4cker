import * as p from "@clack/prompts";
import os from "os";
import { execSync } from "child_process";
import { readConfig, updateConfig } from "@/lib/config/manager";

/** detect the OS and choose cron method */
function getPlatform(): "darwin" | "linux" | "windows" | "other" {
  const platform = os.platform();
  if (platform === "darwin") return "darwin";
  if (platform === "linux") return "linux";
  if (platform === "win32") return "windows";
  return "other";
}

/** find the absolute path to the s54r binary */
function findS54rBin(): string {
  try {
    return execSync("which s54r", { encoding: "utf-8" }).trim();
  } catch {
    // fallback to npx
    return "npx s54r";
  }
}

export async function runCronInstallCommand(): Promise<void> {
  p.intro("  sub5tr4cker — install cron job  ");

  const config = readConfig();
  if (!config) {
    p.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }

  const platform = getPlatform();

  if (platform === "windows") {
    await installWindowsCron();
    return;
  }

  const method = platform === "darwin"
    ? await p.select({
        message: "How would you like to run scheduled reminders?",
        options: [
          { value: "launchd", label: "launchd (recommended on macOS)", hint: "runs even when terminal is closed" },
          { value: "crontab", label: "crontab", hint: "simpler, runs when logged in" },
        ],
      })
    : "crontab";

  if (p.isCancel(method)) { p.cancel("Cancelled."); process.exit(0); }

  const interval = await p.select({
    message: "How often should it check for reminders?",
    options: [
      { value: "*/30 * * * *", label: "Every 30 minutes (recommended)" },
      { value: "0 * * * *", label: "Every hour" },
      { value: "0 9 * * *", label: "Once daily at 9am" },
    ],
  });
  if (p.isCancel(interval)) { p.cancel("Cancelled."); process.exit(0); }

  const bin = findS54rBin();

  if (method === "launchd") {
    await installLaunchd(bin, interval as string);
  } else {
    await installCrontab(bin, interval as string);
  }

  updateConfig({ cron: { installed: true, method: method as "crontab" | "launchd", interval: interval as string } });
}

async function installCrontab(bin: string, interval: string): Promise<void> {
  const cronLine = `${interval} ${bin} notify >> ~/.sub5tr4cker/logs/notify.log 2>&1`;

  const confirm = await p.confirm({
    message: `Add to crontab:\n  ${cronLine}\n\nProceed?`,
    initialValue: true,
  });
  if (p.isCancel(confirm) || !confirm) { p.cancel("Cancelled."); process.exit(0); }

  const s = p.spinner();
  s.start("Installing crontab entry...");

  try {
    // read existing crontab, append the new line
    let existing = "";
    try {
      existing = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
    } catch { /* no existing crontab */ }

    // remove any previous s54r notify entries
    const filtered = existing.split("\n").filter((l) => !l.includes("s54r notify") && !l.includes("substrack notify")).join("\n");
    const updated = `${filtered}\n${cronLine}\n`.trimStart();

    const tmp = `/tmp/sub5tr4cker-cron-${Date.now()}`;
    const { writeFileSync } = await import("fs");
    writeFileSync(tmp, updated);
    execSync(`crontab ${tmp}`);
    execSync(`rm ${tmp}`);

    s.stop("Crontab entry added.");
    p.note(`Entry added:\n  ${cronLine}`, "Crontab installed");
    p.outro("Cron job installed. Run 's54r cron-uninstall' to remove it.");
  } catch (e) {
    s.stop("Failed to install crontab.");
    p.log.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    p.note(`To install manually, run:\n  crontab -e\n\nAnd add:\n  ${cronLine}`, "Manual install");
    process.exit(1);
  }
}

async function installLaunchd(bin: string, interval: string): Promise<void> {
  // convert cron interval to launchd StartInterval (seconds)
  const intervalSeconds = cronToSeconds(interval);
  const plistPath = `${os.homedir()}/Library/LaunchAgents/com.sub5tr4cker.notify.plist`;
  const logDir = `${os.homedir()}/.sub5tr4cker/logs`;

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.sub5tr4cker.notify</string>
  <key>ProgramArguments</key>
  <array>
    <string>${bin}</string>
    <string>notify</string>
  </array>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>StandardOutPath</key>
  <string>${logDir}/notify.log</string>
  <key>StandardErrorPath</key>
  <string>${logDir}/notify-error.log</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>`;

  const confirm = await p.confirm({
    message: `Install launchd agent at:\n  ${plistPath}\n\nThis will run 's54r notify' every ${intervalSeconds}s.\nProceed?`,
    initialValue: true,
  });
  if (p.isCancel(confirm) || !confirm) { p.cancel("Cancelled."); process.exit(0); }

  const s = p.spinner();
  s.start("Installing launchd agent...");

  try {
    const { writeFileSync, mkdirSync } = await import("fs");
    mkdirSync(logDir, { recursive: true });
    mkdirSync(`${os.homedir()}/Library/LaunchAgents`, { recursive: true });
    writeFileSync(plistPath, plist);

    // unload existing if present, then load
    try { execSync(`launchctl unload ${plistPath} 2>/dev/null`); } catch { /* ignore */ }
    execSync(`launchctl load ${plistPath}`);

    s.stop("launchd agent installed and loaded.");
    p.note(
      [
        `Agent file: ${plistPath}`,
        `Log file  : ${logDir}/notify.log`,
        "",
        "To stop:    launchctl unload ~/Library/LaunchAgents/com.sub5tr4cker.notify.plist",
        "To uninstall: s54r cron-uninstall",
      ].join("\n"),
      "launchd installed"
    );
    p.outro("Cron job installed via launchd.");
  } catch (e) {
    s.stop("Failed to install launchd agent.");
    p.log.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

async function installWindowsCron(): Promise<void> {
  const bin = findS54rBin();
  const taskName = "sub5tr4cker-notify";

  p.note(
    "Windows Task Scheduler setup requires elevated permissions.\n\n" +
    "Run the following command in PowerShell as Administrator:\n\n" +
    `  $action = New-ScheduledTaskAction -Execute "${bin}" -Argument "notify"\n` +
    `  $trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) -Once -At (Get-Date)\n` +
    `  Register-ScheduledTask -TaskName "${taskName}" -Action $action -Trigger $trigger -RunLevel Highest\n\n` +
    "Or use Task Scheduler GUI:\n" +
    "1. Open Task Scheduler\n" +
    "2. Create Basic Task named 'sub5tr4cker-notify'\n" +
    `3. Set trigger: Daily, repeat every 30 minutes\n` +
    `4. Set action: Start a program → '${bin}' with argument 'notify'`,
    "Windows setup instructions"
  );

  const copied = await p.confirm({
    message: "Did you set up the scheduled task?",
    initialValue: false,
  });
  if (!p.isCancel(copied) && copied) {
    updateConfig({ cron: { installed: true, method: "task-scheduler", interval: "*/30 * * * *" } });
    p.outro("Cron job marked as installed.");
  } else {
    p.outro("You can run these instructions again with 's54r cron-install'.");
  }
}

/** very rough conversion of common cron expressions to seconds */
function cronToSeconds(cron: string): number {
  if (cron === "*/30 * * * *") return 1800;
  if (cron === "0 * * * *") return 3600;
  if (cron === "0 9 * * *") return 86400;
  // default to 30 minutes
  return 1800;
}
