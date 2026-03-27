/**
 * s54r notify — standalone notification script.
 * Designed to be run from cron: polls Telegram for pending confirmations,
 * enqueues due reminders, then runs the notification worker. Exits when done.
 *
 * From the repo use `pnpm s54r notify` (runs tsx) so you always get the latest
 * notify logic; a globally installed `s54r` binary may be an older `dist/cli` build.
 */
import { readConfig, getDbPath } from "@/lib/config/manager";

export async function runNotifyCommand(): Promise<void> {
  // set mode env before anything loads
  process.env.SUB5TR4CKER_MODE = "local";

  const config = readConfig();
  if (!config) {
    console.error("[notify] no local configuration found — run 's54r init' first");
    process.exit(1);
  }

  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();

  const { getAdapter, resetAdapter } = await import("@/lib/storage");
  resetAdapter();
  const adapter = getAdapter();
  await adapter.initialize();

  // poll telegram for pending confirmations first
  if (config.notifications.channels.telegram?.botToken) {
    try {
      const { pollOnce } = await import("@/lib/telegram/polling");
      await pollOnce();
      console.log("[notify] telegram polling done");
    } catch (e) {
      console.error("[notify] telegram polling error:", e);
    }
  }

  // enqueue first, then drain the queue (matches POST /api/cron/reminders)
  let enqueued = 0;
  try {
    const { enqueueReminders } = await import("@/jobs/enqueue-reminders");
    enqueued = await enqueueReminders();
    console.log("[notify] enqueued reminders:", enqueued);
  } catch (e) {
    console.error("[notify] enqueue reminders error:", e);
  }

  try {
    const { runNotificationTasks } = await import("@/jobs/run-notification-tasks");
    let result = await runNotificationTasks();
    // rare: if tasks were just inserted, one extra pass avoids an empty first claim in odd DB timing
    if (enqueued > 0 && result.claimed === 0 && result.completed === 0 && result.failed === 0) {
      await new Promise((r) => setTimeout(r, 200));
      const again = await runNotificationTasks();
      result = {
        claimed: result.claimed + again.claimed,
        completed: result.completed + again.completed,
        failed: result.failed + again.failed,
      };
    }
    console.log("[notify] tasks done:", result);
  } catch (e) {
    console.error("[notify] task runner error:", e);
  }

  await adapter.close();
  process.exit(0);
}
