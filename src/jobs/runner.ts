import cron from "node-cron";
import { checkBillingPeriods } from "./check-billing-periods";
import { enqueueReminders } from "./enqueue-reminders";
import { sendFollowUps } from "./send-follow-ups";
import { runNotificationTasks } from "./run-notification-tasks";

// standalone cron runner — start with `tsx src/jobs/runner.ts`

console.log("SubsTrack cron runner starting...");

// create billing periods — daily at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("[cron] checking billing periods...");
  try {
    await checkBillingPeriods();
    console.log("[cron] billing periods check complete");
  } catch (error) {
    console.error("[cron] billing periods error:", error);
  }
});

// enqueue payment reminders — daily at 10:00
cron.schedule("0 10 * * *", async () => {
  console.log("[cron] enqueueing reminders...");
  try {
    const enqueued = await enqueueReminders();
    console.log("[cron] reminders enqueued:", enqueued);
    const result = await runNotificationTasks({ limit: 50 });
    console.log("[cron] worker ran:", result);
  } catch (error) {
    console.error("[cron] reminders error:", error);
  }
});

// reconcile overdue + enqueue admin follow-ups — every 3 days at 14:00
cron.schedule("0 14 */3 * *", async () => {
  console.log("[cron] follow-ups (reconcile + enqueue)...");
  try {
    const result = await sendFollowUps();
    console.log("[cron] follow-ups result:", result);
    const workerResult = await runNotificationTasks({ limit: 50 });
    console.log("[cron] worker ran:", workerResult);
  } catch (error) {
    console.error("[cron] follow-ups error:", error);
  }
});

// process notification queue — every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  try {
    const result = await runNotificationTasks({ limit: 50 });
    if (result.claimed > 0) {
      console.log("[cron] notification tasks:", result);
    }
  } catch (error) {
    console.error("[cron] notification tasks error:", error);
  }
});

console.log("cron jobs scheduled:");
console.log("  - billing periods: daily at 00:00");
console.log("  - enqueue reminders: daily at 10:00");
console.log("  - follow-ups (reconcile + enqueue): every 3 days at 14:00");
console.log("  - notification worker: every 5 minutes");
