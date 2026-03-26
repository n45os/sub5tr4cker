/**
 * s54r notify — standalone notification script.
 * Designed to be run from cron: polls Telegram for pending confirmations,
 * then sends due payment reminders. Exits when done.
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

  // run notification tasks
  try {
    const { runNotificationTasks } = await import("@/jobs/run-notification-tasks");
    const result = await runNotificationTasks();
    console.log("[notify] tasks done:", result);
  } catch (e) {
    console.error("[notify] task runner error:", e);
  }

  // enqueue reminders for upcoming due periods
  try {
    const { enqueueReminders } = await import("@/jobs/enqueue-reminders");
    const count = await enqueueReminders();
    console.log("[notify] enqueued reminders:", count);
  } catch (e) {
    console.error("[notify] enqueue reminders error:", e);
  }

  await adapter.close();
  process.exit(0);
}
