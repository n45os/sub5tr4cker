/**
 * Telegram polling helpers for local mode.
 * In production (advanced mode) we use webhooks; locally we poll.
 * Two modes:
 *  - pollOnce(): one-shot call for cron scripts — fetches updates, processes them, exits
 *  - startPolling(): long-polling loop for s54r start (web server) — runs until process ends
 */
import fs from "fs";
import path from "path";
import { getDataDir, readConfig, updateConfig } from "@/lib/config/manager";
import { getBot } from "./bot";

function getPollingLockPath(): string {
  return path.join(getDataDir(), "telegram-polling.lock");
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockPid(): number | null {
  const lockPath = getPollingLockPath();
  if (!fs.existsSync(lockPath)) return null;

  const raw = fs.readFileSync(lockPath, "utf-8").trim();
  const pid = Number(raw);
  if (!Number.isFinite(pid) || pid <= 0) {
    fs.rmSync(lockPath, { force: true });
    return null;
  }

  if (!isPidAlive(pid)) {
    fs.rmSync(lockPath, { force: true });
    return null;
  }

  return pid;
}

function claimPollingLock(): boolean {
  const existingPid = readLockPid();
  if (existingPid) {
    return existingPid === process.pid;
  }

  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.writeFileSync(getPollingLockPath(), String(process.pid), "utf-8");
  return true;
}

function releasePollingLock(): void {
  const existingPid = readLockPid();
  if (existingPid === process.pid) {
    fs.rmSync(getPollingLockPath(), { force: true });
  }
}

/**
 * Fetch and process any pending Telegram updates since the last known update_id.
 * Used by 's54r notify' cron scripts.
 */
export async function pollOnce(): Promise<number> {
  // if the web server is already long-polling, skip the one-shot poll
  const activePid = readLockPid();
  if (activePid && activePid !== process.pid) {
    console.log(`[telegram] skipping pollOnce because pid ${activePid} is already polling`);
    return 0;
  }

  const bot = await getBot();
  const config = readConfig();
  const lastUpdateId = config?.notifications.channels.telegram?.lastUpdateId;

  const offset = lastUpdateId !== undefined ? lastUpdateId + 1 : undefined;

  const updates = await bot.api.getUpdates({ offset, timeout: 0, limit: 100 });

  if (updates.length === 0) return 0;

  for (const update of updates) {
    try {
      await bot.handleUpdate(update);
    } catch (e) {
      console.error("[polling] error handling update:", update.update_id, e);
    }
  }

  // persist the last processed update_id so we don't re-process on the next run
  const lastId = updates[updates.length - 1].update_id;
  if (config?.notifications.channels.telegram) {
    updateConfig({
      notifications: {
        ...config.notifications,
        channels: {
          ...config.notifications.channels,
          telegram: {
            ...config.notifications.channels.telegram,
            lastUpdateId: lastId,
          },
        },
      },
    });
  }

  return updates.length;
}

/**
 * Start long-polling loop (for use with the web server in local mode).
 * Uses grammy's built-in bot.start() which handles reconnection automatically.
 * This blocks indefinitely until the process receives SIGINT/SIGTERM.
 */
export async function startPolling(): Promise<void> {
  if (!claimPollingLock()) {
    const activePid = readLockPid();
    console.log(
      `[telegram] skipping long-polling because pid ${activePid ?? "unknown"} already holds the lock`
    );
    return;
  }

  const bot = await getBot();
  console.log("[telegram] starting long-polling...");

  process.on("SIGINT", async () => {
    await bot.stop();
    releasePollingLock();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await bot.stop();
    releasePollingLock();
    process.exit(0);
  });
  process.on("exit", () => {
    releasePollingLock();
  });

  try {
    await bot.start({
      onStart: (info) => {
        console.log(`[telegram] polling as @${info.username}`);
      },
    });
  } finally {
    releasePollingLock();
  }
}
