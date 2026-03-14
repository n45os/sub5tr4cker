import { InlineKeyboard } from "grammy";
import { getBot, isTelegramEnabled } from "./bot";

interface SendTelegramMessageParams {
  chatId: number;
  text: string;
  keyboard?: InlineKeyboard;
  parseMode?: "HTML" | "MarkdownV2";
}

// send a message to a Telegram chat
export async function sendTelegramMessage(
  params: SendTelegramMessageParams
): Promise<number | null> {
  if (!isTelegramEnabled()) return null;

  try {
    const bot = getBot();
    const result = await bot.api.sendMessage(params.chatId, params.text, {
      parse_mode: params.parseMode ?? "HTML",
      reply_markup: params.keyboard,
    });
    return result.message_id;
  } catch (error) {
    console.error("telegram send error:", error);
    return null;
  }
}

// send a payment reminder to a member via Telegram
export async function sendPaymentReminder(
  chatId: number,
  memberName: string,
  groupName: string,
  periodLabel: string,
  amount: number,
  currency: string,
  paymentLink: string | null,
  keyboard: InlineKeyboard
): Promise<number | null> {
  const payLine = paymentLink
    ? `\n\n<b>Pay via:</b> <a href="${paymentLink}">${paymentLink}</a>`
    : "";

  const text =
    `💳 <b>Payment Reminder</b>\n\n` +
    `Hi ${memberName},\n\n` +
    `<b>${groupName}</b> — ${periodLabel}\n` +
    `Your share: <b>${amount.toFixed(2)}${currency}</b>` +
    payLine +
    `\n\nPlease pay and confirm below.`;

  return sendTelegramMessage({ chatId, text, keyboard });
}

// send admin notification when a member confirms payment
export async function sendAdminConfirmationRequest(
  chatId: number,
  memberName: string,
  groupName: string,
  periodLabel: string,
  amount: number,
  currency: string,
  keyboard: InlineKeyboard
): Promise<number | null> {
  const text =
    `✅ <b>Payment Confirmation</b>\n\n` +
    `<b>${memberName}</b> says they paid <b>${amount.toFixed(2)}${currency}</b>\n` +
    `for <b>${groupName}</b> — ${periodLabel}\n\n` +
    `Please verify:`;

  return sendTelegramMessage({ chatId, text, keyboard });
}

// send price-change announcement to a chat
export async function sendPriceChange(
  chatId: number,
  groupName: string,
  serviceName: string,
  oldPrice: number,
  newPrice: number,
  currency: string
): Promise<number | null> {
  const text =
    `📢 <b>Price update</b>\n\n` +
    `<b>${groupName}</b> (${serviceName})\n\n` +
    `Previous: <s>${oldPrice.toFixed(2)}${currency}</s>\n` +
    `New: <b>${newPrice.toFixed(2)}${currency}</b>\n\n` +
    `Your next billing cycle will use the new amount.`;

  return sendTelegramMessage({ chatId, text });
}
