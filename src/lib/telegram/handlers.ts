import { Bot, Context } from "grammy";
import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, User, Group } from "@/models";
import { verifyInviteLinkToken } from "@/lib/tokens";
import { getSetting } from "@/lib/settings/service";
import { enqueueTask } from "@/lib/tasks/queue";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";

// register all bot handlers
export function registerHandlers(bot: Bot): void {
  // /start command — handles deep links for account linking (payload may have leading space)
  bot.command("start", async (ctx) => {
    const raw = typeof ctx.match === "string" ? ctx.match : "";
    const payload = raw.trim();

    try {
      if (payload.startsWith("link_")) {
        const code = payload.replace("link_", "").trim();
        await handleAccountLink(ctx, code);
        return;
      }

      if (payload.startsWith("invite_")) {
        const token = payload.replace("invite_", "").trim();
        await handleInviteLink(ctx, token);
        return;
      }

      await ctx.reply(
        "Welcome to sub5tr4cker!\n\n" +
          "I help you manage shared subscription payments.\n\n" +
          "Link your account from the sub5tr4cker web app to get started."
      );
    } catch (err) {
      console.error("telegram /start handler error:", err);
      await ctx.reply("Something went wrong. Please try again or generate a new link from the app.").catch(() => {});
    }
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
  code: string
): Promise<void> {
  await dbConnect();
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username ?? null;
  if (!chatId) {
    await ctx.reply("Could not get chat id.");
    return;
  }

  if (!code || code.length < 8) {
    await ctx.reply(
      "Invalid link. Generate a new one from the app Profile page."
    );
    return;
  }

  const now = new Date();
  const user = await User.findOneAndUpdate(
    {
      "telegramLinkCode.code": code,
      "telegramLinkCode.expiresAt": { $gt: now },
    },
    {
      $set: {
        "telegram.chatId": chatId,
        "telegram.username": username,
        "telegram.linkedAt": now,
        "notificationPreferences.telegram": true,
      },
      $unset: { telegramLinkCode: "" },
    },
    { returnDocument: "after" }
  );

  if (!user) {
    await ctx.reply(
      "This link has expired or is invalid. Generate a new one from the app Profile page."
    );
    return;
  }

  await ctx.reply(
    "✅ Account linked! You’ll receive payment reminders here when enabled for your groups."
  );
}

async function handleInviteLink(ctx: Context, token: string): Promise<void> {
  const payload = await verifyInviteLinkToken(token);
  if (!payload) {
    await ctx.reply(
      "This invite link has expired or is invalid. Ask your group admin to send you a new invite."
    );
    return;
  }

  await dbConnect();
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username ?? null;
  if (!chatId) {
    await ctx.reply("Could not get chat id.");
    return;
  }

  let group = null;
  if (payload.groupId) {
    group = await Group.findById(payload.groupId);
  } else {
    group = await Group.findOne({
      isActive: true,
      "members._id": payload.memberId,
    });
  }
  if (!group || !group.isActive) {
    await ctx.reply("This invite link is no longer valid.");
    return;
  }

  const member = group.members.find(
    (m: { _id: { toString: () => string }; isActive: boolean; leftAt: unknown }) =>
      m._id.toString() === payload.memberId && m.isActive && !m.leftAt
  );
  if (!member) {
    await ctx.reply("This invite link is no longer valid.");
    return;
  }

  if (member.user) {
    const user = await User.findByIdAndUpdate(
      member.user,
      {
        "telegram.chatId": chatId,
        "telegram.username": username,
        "telegram.linkedAt": new Date(),
      },
      { new: true }
    );
    if (user) {
      await ctx.reply(
        "✅ Account linked! You’ll receive payment reminders here when enabled for your groups."
      );
      return;
    }
  }

  const appUrl = await getSetting("general.appUrl");
  const appHint = appUrl?.trim()
    ? ` Register at ${appUrl.replace(/\/$/, "")} with the email you were invited with, then link Telegram from Settings.`
    : " Register with the email you were invited with, then link Telegram from the app Settings.";
  await ctx.reply(
    "You’re not registered yet." + appHint
  );
}
