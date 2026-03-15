import { Bot } from "grammy";
import { registerHandlers } from "./handlers";
import { getSetting } from "@/lib/settings/service";

let bot: Bot | null = null;
let botToken: string | null = null;
let initPromise: Promise<Bot> | null = null;

// get or create the singleton bot instance and register handlers once
export async function getBot(): Promise<Bot> {
  const token = await getSetting("telegram.botToken");
  if (!token) {
    throw new Error("telegram.botToken setting is not configured");
  }

  // return existing bot if token hasn't changed
  if (bot && botToken === token) {
    return bot;
  }

  // if an init is already in flight for a new bot, wait for it
  if (initPromise) {
    return initPromise;
  }

  // build, init, and only then expose the bot singleton
  initPromise = (async () => {
    const instance = new Bot(token);
    registerHandlers(instance);
    await instance.init();
    botToken = token;
    bot = instance;
    initPromise = null;
    return instance;
  })();

  return initPromise;
}

// check if Telegram is configured
export async function isTelegramEnabled(): Promise<boolean> {
  if (bot && botToken) {
    return true;
  }

  const token = await getSetting("telegram.botToken");
  return !!token;
}
