import cron from "node-cron";
import { checkBillingPeriods } from "./check-billing-periods";
import { sendReminders } from "./send-reminders";
import { sendFollowUps } from "./send-follow-ups";

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

// send reminders — daily at 10:00
cron.schedule("0 10 * * *", async () => {
  console.log("[cron] sending reminders...");
  try {
    await sendReminders();
    console.log("[cron] reminders sent");
  } catch (error) {
    console.error("[cron] reminders error:", error);
  }
});

// send follow-ups — every 3 days at 14:00
cron.schedule("0 14 */3 * *", async () => {
  console.log("[cron] sending follow-ups...");
  try {
    await sendFollowUps();
    console.log("[cron] follow-ups sent");
  } catch (error) {
    console.error("[cron] follow-ups error:", error);
  }
});

console.log("cron jobs scheduled:");
console.log("  - billing periods: daily at 00:00");
console.log("  - reminders: daily at 10:00");
console.log("  - follow-ups: every 3 days at 14:00");
