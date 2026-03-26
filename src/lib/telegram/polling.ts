/**
 * Telegram polling helpers for local mode.
 * In production (advanced mode) we use webhooks; locally we poll.
 * Two modes:
 *  - pollOnce(): one-shot call for cron scripts — fetches updates, processes them, exits
 *  - startPolling(): long-polling loop for s54r start (web server) — runs until process ends
 */
import { readConfig, updateConfig } from "@/lib/config/manager";
import { getBot } from "./bot";

/**
 * Fetch and process any pending Telegram updates since the last known update_id.
 * Used by 's54r notify' cron scripts.
 */
export async function pollOnce(): Promise<number> {
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
  const bot = await getBot();
  console.log("[telegram] starting long-polling...");

  process.on("SIGINT", async () => {
    await bot.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await bot.stop();
    process.exit(0);
  });

  await bot.start({
    onStart: (info) => {
      console.log(`[telegram] polling as @${info.username}`);
    },
  });
}
