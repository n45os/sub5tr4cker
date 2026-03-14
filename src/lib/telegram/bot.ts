import { Bot } from "grammy";
import { registerHandlers } from "./handlers";
import { getSetting } from "@/lib/settings/service";

let bot: Bot | null = null;
let botToken: string | null = null;

// get or create the singleton bot instance and register handlers once
export async function getBot(): Promise<Bot> {
  const token = await getSetting("telegram.botToken");
  if (!token) {
    throw new Error("telegram.botToken setting is not configured");
  }

  if (bot && botToken === token) {
    return bot;
  }

  botToken = token;
  bot = new Bot(token);
  registerHandlers(bot);
  return bot;
}

// check if Telegram is configured
export async function isTelegramEnabled(): Promise<boolean> {
  if (bot && botToken) {
    return true;
  }

  const token = await getSetting("telegram.botToken");
  return !!token;
}
