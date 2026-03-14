import { Bot, Context } from "grammy";
import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, User, Group } from "@/models";
import { verifyLinkToken } from "@/lib/tokens";
import { enqueueTask } from "@/lib/tasks/queue";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";

// register all bot handlers
export function registerHandlers(bot: Bot): void {
  // /start command — handles deep links for account linking
  bot.command("start", async (ctx) => {
    const payload = ctx.match;

    if (payload?.startsWith("link_")) {
      const linkToken = payload.replace("link_", "");
      await handleAccountLink(ctx, linkToken);
      return;
    }

    await ctx.reply(
      "Welcome to sub5tr4cker!\n\n" +
        "I help you manage shared subscription payments.\n\n" +
        "Link your account from the sub5tr4cker web app to get started."
    );
  });

  // callback query handler for inline buttons
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const parts = data.split(":");

    if (parts.length < 3) {
      await ctx.answerCallbackQuery({ text: "Invalid action" });
      return;
    }

    const [action, periodId, memberId] = parts;

    switch (action) {
      case "confirm":
        await handleMemberConfirm(ctx as Context, periodId, memberId);
        break;
      case "snooze":
        await handleSnooze(ctx as Context);
        break;
      case "admin_confirm":
        await handleAdminConfirm(ctx as Context, periodId, memberId);
        break;
      case "admin_reject":
        await handleAdminReject(ctx as Context, periodId, memberId);
        break;
      default:
        await ctx.answerCallbackQuery({ text: "Unknown action" });
    }
  });
}

async function handleMemberConfirm(
  ctx: Context,
  periodId: string,
  memberId: string
): Promise<void> {
  await dbConnect();

  const period = await BillingPeriod.findById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }

  const payment = period.payments.find(
    (p: { memberId: { toString: () => string } }) => p.memberId.toString() === memberId
  );
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }

  if (payment.status !== "pending" && payment.status !== "overdue") {
    await ctx.answerCallbackQuery({ text: "Already confirmed!" });
    return;
  }

  payment.status = "member_confirmed";
  payment.memberConfirmedAt = new Date();
  await period.save();

  await ctx.answerCallbackQuery?.({ text: "Marked as paid!" });
  await ctx.editMessageText?.(
    "You've confirmed payment for this period. Waiting for admin verification."
  );

  // enqueue admin nudge (email + telegram) via notification task queue
  const group = await Group.findById(period.group);
  if (group) {
    await enqueueTask({
      type: "admin_confirmation_request",
      runAt: new Date(),
      payload: {
        groupId: (group._id as { toString: () => string }).toString(),
        billingPeriodId: periodId,
      },
    });
    await runNotificationTasks({ limit: 5 });
  }
}

async function handleSnooze(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery?.({
    text: "OK, I'll remind you again later.",
  });
  await ctx.editMessageText?.(
    "Snoozed. You'll get another reminder soon. Don't forget to pay!"
  );
}

async function handleAdminConfirm(
  ctx: Context,
  periodId: string,
  memberId: string
): Promise<void> {
  await dbConnect();

  const period = await BillingPeriod.findById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }

  const payment = period.payments.find(
    (p: { memberId: { toString: () => string } }) => p.memberId.toString() === memberId
  );
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }

  payment.status = "confirmed";
  payment.adminConfirmedAt = new Date();

  // check if all payments are confirmed
  const allConfirmed = period.payments.every(
    (p: { status: string }) => p.status === "confirmed" || p.status === "waived"
  );
  period.isFullyPaid = allConfirmed;

  await period.save();

  await ctx.answerCallbackQuery?.({ text: "Payment confirmed!" });
  await ctx.editMessageText?.(
    `Confirmed payment from ${payment.memberNickname} (${payment.amount.toFixed(2)}${period.currency}).`
  );
}

async function handleAdminReject(
  ctx: Context,
  periodId: string,
  memberId: string
): Promise<void> {
  await dbConnect();

  const period = await BillingPeriod.findById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }

  const payment = period.payments.find(
    (p: { memberId: { toString: () => string } }) => p.memberId.toString() === memberId
  );
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }

  payment.status = "pending";
  payment.memberConfirmedAt = null;
  await period.save();

  await ctx.answerCallbackQuery?.({ text: "Payment rejected" });
  await ctx.editMessageText?.(
    `Rejected payment claim from ${payment.memberNickname}. They'll be reminded again.`
  );
}

async function handleAccountLink(
  ctx: Context,
  linkToken: string
): Promise<void> {
  const payload = await verifyLinkToken(linkToken);
  if (!payload) {
    await ctx.reply("This link has expired or is invalid. Generate a new one from the sub5tr4cker app.");
    return;
  }

  await dbConnect();
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username ?? null;
  if (!chatId) {
    await ctx.reply("Could not get chat id.");
    return;
  }

  const user = await User.findByIdAndUpdate(
    payload.userId,
    {
      "telegram.chatId": chatId,
      "telegram.username": username,
      "telegram.linkedAt": new Date(),
    },
    { new: true }
  );

  if (!user) {
    await ctx.reply("User not found. Please try again from the app.");
    return;
  }

  await ctx.reply(
    "✅ Account linked! You’ll receive payment reminders here when enabled for your groups."
  );
}
