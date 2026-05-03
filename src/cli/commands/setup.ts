import fs from "fs";
import path from "path";
import { createClackPrompter } from "@/cli/wizard/clack-prompter";
import { loadCurrentConfig, seedSettings, writeBootstrapEnv } from "@/cli/wizard/finalize";
import { runAuthStep } from "@/cli/wizard/steps/auth";
import { runDatabaseStep } from "@/cli/wizard/steps/database";
import { runEmailStep } from "@/cli/wizard/steps/email";
import { runGeneralStep } from "@/cli/wizard/steps/general";
import { runTelegramStep } from "@/cli/wizard/steps/telegram";

const MONGODB_DATA_DIR = ".mongodb-data";

export async function runSetupCommand() {
  const prompter = createClackPrompter();
  const rootDir = process.cwd();
  const state = await loadCurrentConfig(rootDir);

  // ensure local Mongo data dir exists for repo-root persistence
  const mongoDataPath = path.join(rootDir, MONGODB_DATA_DIR);
  fs.mkdirSync(mongoDataPath, { recursive: true });

  await prompter.intro("SubsTrack setup");
  await prompter.note(
    [
      "This wizard keeps only bootstrap values in .env.local and seeds the rest into the Settings collection.",
      "Prefer Telegram for notifications: members confirm payment in one tap there; email alone makes that flow harder.",
    ].join("\n"),
    "How setup works"
  );

  await runDatabaseStep(prompter, state);
  await runAuthStep(prompter, state);
  await runTelegramStep(prompter, state);
  await runEmailStep(prompter, state);
  await runGeneralStep(prompter, state);

  await writeBootstrapEnv(rootDir, state);
  await seedSettings(rootDir, state);

  await prompter.outro(
    [
      "Setup complete.",
      `Bootstrap env written to ${path.join(rootDir, ".env.local")}.`,
      "Settings were seeded into MongoDB.",
      "Next steps:",
      "- run pnpm dev",
      "- open the dashboard settings page to verify the final values",
    ].join("\n")
  );
}
