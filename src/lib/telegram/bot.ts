import { Bot } from "grammy";

let bot: Bot | null = null;

// get or create the singleton bot instance
export function getBot(): Bot {
  if (bot) return bot;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
  }

  bot = new Bot(token);
  return bot;
}

// check if Telegram is configured
export function isTelegramEnabled(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}
