import { Bot, Context } from "grammy";
import { db } from "@/lib/storage";
import type { StorageGroup } from "@/lib/storage/types";
import {
  verifyInviteLinkToken,
  createMagicLoginToken,
  createUnsubscribeToken,
  getUnsubscribeUrl,
} from "@/lib/tokens";
import { getSetting } from "@/lib/settings/service";
import { isPublicAppUrl, normalizeAppUrl } from "@/lib/public-app-url";
import { enqueueTask } from "@/lib/tasks/queue";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";
import { sendNotification } from "@/lib/notifications/service";
import { buildTelegramWelcomeEmailHtml } from "@/lib/email/templates/group-invite";
import { formatGroupPaymentDetailsPlainText } from "@/lib/telegram/payment-details-text";
import { getTelegramPlaceholderEmail } from "@/lib/users/placeholder-email";

function buildBillingSummary(group: StorageGroup): string {
  const { billing } = group;
  const cycle = billing.cycleType === "yearly" ? "year" : "month";
  const price = `${billing.currentPrice} ${billing.currency}`;
  if (billing.mode === "equal_split") {
    return `${price} per ${cycle}, equal split`;
  }
  if (billing.mode === "fixed_amount" && billing.fixedMemberAmount != null) {
    return `${billing.fixedMemberAmount} ${billing.currency} per member per ${cycle}`;
  }
  return `${price} per ${cycle} (variable)`;
}

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
      case "paydetails":
        await handlePayDetails(ctx as Context, periodId);
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
  const store = await db();

  const period = await store.getBillingPeriodById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }

  const payment = period.payments.find((p) => p.memberId === memberId);
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }

  if (payment.status !== "pending" && payment.status !== "overdue") {
    await ctx.answerCallbackQuery({ text: "Already confirmed!" });
    return;
  }

  await store.updatePaymentStatus(periodId, memberId, {
    status: "member_confirmed",
    memberConfirmedAt: new Date(),
  });

  await ctx.answerCallbackQuery?.({ text: "Marked as paid!" });
  await ctx.editMessageText?.(
    "You've confirmed payment for this period. Waiting for admin verification."
  );

  // enqueue admin verification nudge (telegram when linked; email fallback)
  const group = await store.getGroup(period.groupId);
  if (group) {
    await enqueueTask({
      type: "admin_confirmation_request",
      runAt: new Date(),
      payload: {
        groupId: group.id,
        billingPeriodId: periodId,
      },
    });
    await runNotificationTasks({ limit: 5 });
  }
}

async function handlePayDetails(ctx: Context, periodId: string): Promise<void> {
  const store = await db();

  const period = await store.getBillingPeriodById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }

  const group = await store.getGroup(period.groupId);
  if (!group) {
    await ctx.answerCallbackQuery({ text: "Group not found" });
    return;
  }

  const detailText = formatGroupPaymentDetailsPlainText(group);

  await ctx
    .answerCallbackQuery({
      text: "Sending how-to-pay details in a follow-up message.",
    })
    .catch(() => {});

  await ctx.reply(detailText).catch((err) => {
    console.error("telegram paydetails reply error:", err);
  });
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
  const store = await db();

  const period = await store.getBillingPeriodById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }

  const payment = period.payments.find((p) => p.memberId === memberId);
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }

  const updated = await store.updatePaymentStatus(periodId, memberId, {
    status: "confirmed",
    adminConfirmedAt: new Date(),
  });
  const payAfter = updated.payments.find((p) => p.memberId === memberId);

  await ctx.answerCallbackQuery?.({ text: "Payment confirmed!" });
  await ctx.editMessageText?.(
    `Confirmed payment from ${payAfter?.memberNickname ?? payment.memberNickname} (${payment.amount.toFixed(2)}${updated.currency}).`
  );
}

async function handleAdminReject(
  ctx: Context,
  periodId: string,
  memberId: string
): Promise<void> {
  const store = await db();

  const period = await store.getBillingPeriodById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }

  const payment = period.payments.find((p) => p.memberId === memberId);
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }

  await store.updatePaymentStatus(periodId, memberId, {
    status: "pending",
    memberConfirmedAt: null,
  });

  await ctx.answerCallbackQuery?.({ text: "Payment rejected" });
  await ctx.editMessageText?.(
    `Rejected payment claim from ${payment.memberNickname}. They'll be reminded again.`
  );
}

async function handleAccountLink(
  ctx: Context,
  code: string
): Promise<void> {
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

  const store = await db();
  const now = new Date();
  const user = await store.linkTelegramAccountWithLinkCode({
    code,
    chatId,
    username,
    now,
  });

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

  const store = await db();
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username ?? null;
  if (!chatId) {
    await ctx.reply("Could not get chat id.");
    return;
  }

  const group = await store.findActiveGroupForMemberInvitation({
    groupId: payload.groupId ?? null,
    memberId: payload.memberId,
  });
  if (!group) {
    await ctx.reply("This invite link is no longer valid.");
    return;
  }

  const member = group.members.find(
    (m) => m.id === payload.memberId && m.isActive && !m.leftAt
  );
  if (!member) {
    await ctx.reply("This invite link is no longer valid.");
    return;
  }

  const wasAccepted = !!member.acceptedAt;
  const now = new Date();
  const normalizedEmail = (member.email ?? getTelegramPlaceholderEmail(member.id))
    .toLowerCase()
    .trim();
  let user = member.userId ? await store.getUser(member.userId) : null;
  if (!user) {
    user = await store.getUserByEmail(normalizedEmail);
  }

  if (!user) {
    user = await store.createUser({
      name: member.nickname.trim() || normalizedEmail,
      email: normalizedEmail,
      role: "user",
      hashedPassword: null,
      notificationPreferences: {
        email: true,
        telegram: true,
        reminderFrequency: "every_3_days",
      },
    });
  } else {
    await store.updateUser(user.id, {
      telegram: {
        chatId,
        username,
        linkedAt: now,
      },
      notificationPreferences: {
        ...user.notificationPreferences,
        telegram: true,
      },
    });
    user = (await store.getUser(user.id))!;
  }

  const nextMembers = group.members.map((m) =>
    m.id === member.id
      ? {
          ...m,
          userId: user!.id,
          acceptedAt: m.acceptedAt ?? now,
        }
      : m
  );
  await store.updateGroup(group.id, { members: nextMembers });

  // send welcome email at most once per user (first-claim wins)
  const shouldSendWelcomeEmail =
    !wasAccepted && (await store.tryClaimWelcomeEmailSentAt(user.id, now));
  if (shouldSendWelcomeEmail) {
    const appUrlSetting = await getSetting("general.appUrl");
    const baseUrl = (normalizeAppUrl(appUrlSetting) || "http://localhost:3054").replace(
      /\/$/,
      ""
    );
    const magicToken = await createMagicLoginToken(user.id);
    const magicLoginUrl = `${baseUrl}/invite-callback?token=${encodeURIComponent(magicToken)}&groupId=${encodeURIComponent(group.id)}`;
    const sendEmail = !!member.email && !member.unsubscribedFromEmail;
    const unsubscribeUrl = sendEmail
      ? await getUnsubscribeUrl(
          await createUnsubscribeToken(member.id, group.id)
        )
      : null;

    const adminUser = await store.getUser(group.adminId);
    const telegramWelcomeParams = {
      memberName: member.nickname,
      groupName: group.name,
      groupId: group.id,
      serviceName: group.service.name,
      adminName: adminUser?.name ?? "The group admin",
      billingSummary: buildBillingSummary(group),
      paymentPlatform: group.payment.platform,
      paymentLink: group.payment.link ?? null,
      paymentInstructions: group.payment.instructions ?? null,
      isPublic: isPublicAppUrl(appUrlSetting),
      appUrl: normalizeAppUrl(appUrlSetting),
      telegramBotUsername: null,
      telegramInviteLink: null,
      unsubscribeUrl,
      accentColor: group.service?.accentColor ?? null,
      theme: group.service?.emailTheme ?? "clean",
      magicLoginUrl,
    };
    const emailHtml = buildTelegramWelcomeEmailHtml(telegramWelcomeParams);
    const emailParams =
      group.notifications?.saveEmailParams === true
        ? { template: "telegram_welcome" as const, ...telegramWelcomeParams }
        : undefined;
    await sendNotification(
      {
        email: user.email,
        telegramChatId: null,
        userId: user.id,
        preferences: {
          email: sendEmail,
          telegram: false,
        },
      },
      {
        type: "invite",
        subject: `Welcome to ${group.name}`,
        emailHtml,
        telegramText: `Welcome to ${group.name}`,
        groupId: group.id,
        emailParams,
      }
    );
    await ctx.reply(
      "✅ Account linked! Check your email for a secure sign-in link to open your dashboard."
    );
    return;
  }

  await ctx.reply(
    "✅ Account linked! You’ll receive payment reminders here when enabled for your groups."
  );
}
