import * as p from "@clack/prompts";
import crypto from "crypto";
import { writeConfig, readConfig, getDataDir, getConfigPath } from "@/lib/config/manager";
import { sub5tr4ckerConfigSchema, type Sub5tr4ckerConfig } from "@/lib/config/schema";
import { existsSync } from "fs";

function getLocalCommandHint(command: string): string {
  // in a repo clone, prefer the package script
  if (existsSync("package.json")) {
    return `pnpm s54r ${command}`;
  }

  // published/global install path
  return `s54r ${command}`;
}

export async function runInitCommand(): Promise<void> {
  console.clear();
  p.intro("  sub5tr4cker — local setup  ");

  // check for existing config
  if (existsSync(getConfigPath())) {
    const overwrite = await p.confirm({
      message: "A local installation already exists. Re-run setup?",
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Setup cancelled. Your existing configuration was not changed.");
      process.exit(0);
    }
  }

  // step 1: notification channel
  const channel = await p.select({
    message: "How should sub5tr4cker notify people?",
    options: [
      { value: "email", label: "Email (via Resend)", hint: "recommended" },
      { value: "telegram", label: "Telegram (bot)" },
      { value: "both", label: "Both email and Telegram" },
    ],
  });
  if (p.isCancel(channel)) { p.cancel("Setup cancelled."); process.exit(0); }

  let emailConfig: Sub5tr4ckerConfig["notifications"]["channels"]["email"];
  let telegramConfig: Sub5tr4ckerConfig["notifications"]["channels"]["telegram"];

  // step 2a: email config
  if (channel === "email" || channel === "both") {
    p.note(
      "You need a free Resend account to send emails.\n" +
      "Sign up at https://resend.com — the free tier sends 3,000 emails/month.",
      "Email setup"
    );

    const apiKey = await p.text({
      message: "Resend API key",
      placeholder: "re_...",
      validate: (v) => (v.startsWith("re_") ? undefined : "Resend API keys start with 're_'"),
    });
    if (p.isCancel(apiKey)) { p.cancel("Setup cancelled."); process.exit(0); }

    const fromAddress = await p.text({
      message: "From address (e.g. Sub5tr4cker <noreply@yourdomain.com>)",
      placeholder: "Sub5tr4cker <noreply@example.com>",
      validate: (v) => (v.includes("@") ? undefined : "Enter a valid email address or 'Name <email>'"),
    });
    if (p.isCancel(fromAddress)) { p.cancel("Setup cancelled."); process.exit(0); }

    emailConfig = { provider: "resend", apiKey: apiKey as string, fromAddress: fromAddress as string };
  }

  // step 2b: telegram config
  if (channel === "telegram" || channel === "both") {
    p.note(
      "Create a Telegram bot:\n" +
      "1. Open Telegram and message @BotFather\n" +
      "2. Send /newbot and follow the instructions\n" +
      "3. Copy the bot token it gives you",
      "Telegram setup"
    );

    const botToken = await p.text({
      message: "Telegram bot token",
      placeholder: "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ",
      validate: (v) => (v.includes(":") ? undefined : "Paste the full bot token from @BotFather"),
    });
    if (p.isCancel(botToken)) { p.cancel("Setup cancelled."); process.exit(0); }

    telegramConfig = { botToken: botToken as string, pollingEnabled: true };
  }

  // step 3: admin contact info
  const adminEmail = await p.text({
    message: "Your email address (used as the admin account)",
    placeholder: "you@example.com",
    validate: (v) => (v.includes("@") ? undefined : "Enter a valid email address"),
  });
  if (p.isCancel(adminEmail)) { p.cancel("Setup cancelled."); process.exit(0); }

  const adminName = await p.text({
    message: "Your name (shown in notifications)",
    placeholder: "Your Name",
    defaultValue: "Admin",
  });
  if (p.isCancel(adminName)) { p.cancel("Setup cancelled."); process.exit(0); }

  // write config
  const s = p.spinner();
  s.start("Creating configuration...");

  const authToken = crypto.randomBytes(32).toString("hex");
  const config = sub5tr4ckerConfigSchema.parse({
    mode: "local",
    port: 3054,
    authToken,
    adminEmail: adminEmail as string,
    adminName: (adminName as string) || "Admin",
    notifications: {
      channels: {
        email: emailConfig,
        telegram: telegramConfig,
      },
      defaultChannel: (channel === "both" ? "email" : channel) as "email" | "telegram",
    },
  });

  writeConfig(config);
  s.stop("Configuration saved.");

  // summary
  p.note(
    [
      `Data directory : ${getDataDir()}`,
      `Config file    : ${getConfigPath()}`,
      `Port           : 3054`,
      `Channels       : ${[emailConfig && "email", telegramConfig && "telegram"].filter(Boolean).join(", ")}`,
    ].join("\n"),
    "Setup complete"
  );

  p.note(
    "To start the dashboard:\n" +
    `  ${getLocalCommandHint("start")}\n\n` +
    "To enable automatic reminders (cron):\n" +
    `  ${getLocalCommandHint("cron-install")}\n\n` +
    "To run a manual notification check:\n" +
    `  ${getLocalCommandHint("notify")}`,
    "Next steps"
  );

  p.outro(`Ready. Run '${getLocalCommandHint("start")}' to open the dashboard.`);
}
