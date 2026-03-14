import { Bot, Context } from "grammy";
import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, User, Group } from "@/models";
import { adminVerificationKeyboard } from "./keyboards";
import { sendAdminConfirmationRequest } from "./send";

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
      "Welcome to SubsTrack!\n\n" +
        "I help you manage shared subscription payments.\n\n" +
        "Link your account from the SubsTrack web app to get started."
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
        await handleSnooze(ctx as Context, periodId, memberId);
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

  // notify admin
  const group = await Group.findById(period.group);
  if (group) {
    const admin = await User.findById(group.admin);
    if (admin?.telegram?.chatId) {
      const keyboard = adminVerificationKeyboard(periodId, memberId);
      await sendAdminConfirmationRequest(
        admin.telegram.chatId,
        payment.memberNickname,
        group.name,
        period.periodLabel,
        payment.amount,
        period.currency,
        keyboard
      );
    }
  }
}

async function handleSnooze(
  ctx: Context,
  _periodId: string,
  _memberId: string
): Promise<void> {
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
  _linkToken: string
): Promise<void> {
  // TODO: implement account linking
  // 1. verify linkToken against a temporary token stored in DB
  // 2. update User.telegram.chatId with ctx.chat.id
  // 3. update User.telegram.username with ctx.from.username
  await ctx.reply(
    "🔗 Account linking is not yet implemented. Stay tuned!"
  );
}
