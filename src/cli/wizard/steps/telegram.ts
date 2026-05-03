import { generateSecret } from "@/cli/wizard/finalize";
import type { WizardPrompter } from "@/cli/wizard/prompter";
import type { SetupState } from "@/cli/wizard/types";

async function validateTelegramToken(token: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const json = (await response.json()) as { ok?: boolean };

  if (!json.ok) {
    throw new Error("Telegram rejected that bot token");
  }
}

export async function runTelegramStep(
  prompter: WizardPrompter,
  state: SetupState
) {
  await prompter.note(
    [
      "Recommended for payment confirmations: members tap \"I paid\" in Telegram without digging through email.",
      "1) Open Telegram and chat with @BotFather",
      "2) Run /newbot or open one of your existing bots",
      "3) Copy the bot token",
      "4) Add a webhook later from the app settings page or your deployment flow",
    ].join("\n"),
    "Telegram setup"
  );

  const enableTelegram = await prompter.confirm({
    message: "Configure Telegram now?",
    initialValue: !!state.settings["telegram.botToken"],
  });

  if (!enableTelegram) {
    state.settings["telegram.botToken"] = "";
    state.settings["telegram.webhookSecret"] = "";
    state.settings["security.telegramLinkSecret"] = "";
    return;
  }

  const token = await prompter.text({
    message: "Telegram bot token",
    initialValue: state.settings["telegram.botToken"],
    placeholder: "123456789:ABC...",
    validate: (value) => (!value.trim() ? "Bot token is required" : undefined),
  });

  await validateTelegramToken(token);

  state.settings["telegram.botToken"] = token;
  state.settings["telegram.webhookSecret"] =
    state.settings["telegram.webhookSecret"] || generateSecret(24);
  state.settings["security.telegramLinkSecret"] =
    state.settings["security.telegramLinkSecret"] || generateSecret(24);
}
