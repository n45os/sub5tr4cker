import * as p from "@clack/prompts";
import crypto from "crypto";
import path from "path";
import { execSync } from "child_process";
import { writeConfig, readConfig, getDataDir, getConfigPath } from "@/lib/config/manager";
import { sub5tr4ckerConfigSchema, type Sub5tr4ckerConfig } from "@/lib/config/schema";
import { existsSync, cpSync, mkdirSync } from "fs";
import { getPackageRoot } from "@/cli/lib/pkg-root";

function getLocalCommandHint(command: string): string {
  const pkgRoot = getPackageRoot();
  // if running from a dev clone (cwd matches package root), use the pnpm script
  if (process.cwd() === pkgRoot) {
    return `pnpm s54r ${command}`;
  }
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

  // build the Next.js app so `start` is instant
  const pkgRoot = getPackageRoot();
  const standaloneServer = path.join(pkgRoot, ".next", "standalone", "server.js");

  if (!existsSync(standaloneServer)) {
    const bs = p.spinner();
    bs.start("Building the dashboard (this may take a minute)...");
    try {
      const nextBin = path.join(pkgRoot, "node_modules", ".bin", "next");
      execSync(`"${nextBin}" build`, {
        stdio: "pipe",
        env: { ...process.env, SUB5TR4CKER_MODE: "local" },
        cwd: pkgRoot,
      });
      // copy static assets into standalone so the server can serve them
      copyStandaloneAssets(pkgRoot);
      bs.stop("Dashboard built.");
    } catch (e) {
      bs.stop("Build failed — you can retry later with 'pnpm build'.");
      p.log.warn(e instanceof Error ? e.message : String(e));
    }
  }

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

/** copy .next/static and public/ into standalone so the server serves them */
function copyStandaloneAssets(pkgRoot: string): void {
  const staticSrc = path.join(pkgRoot, ".next", "static");
  const staticDst = path.join(pkgRoot, ".next", "standalone", ".next", "static");
  if (existsSync(staticSrc)) {
    mkdirSync(path.dirname(staticDst), { recursive: true });
    cpSync(staticSrc, staticDst, { recursive: true });
  }

  const publicSrc = path.join(pkgRoot, "public");
  const publicDst = path.join(pkgRoot, ".next", "standalone", "public");
  if (existsSync(publicSrc)) {
    cpSync(publicSrc, publicDst, { recursive: true });
  }
}
