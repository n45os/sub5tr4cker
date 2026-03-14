import path from "path";
import { createClackPrompter } from "@/cli/wizard/clack-prompter";
import { loadCurrentConfig, seedSettings, writeBootstrapEnv } from "@/cli/wizard/finalize";
import { runAuthStep } from "@/cli/wizard/steps/auth";
import { runDatabaseStep } from "@/cli/wizard/steps/database";
import { runEmailStep } from "@/cli/wizard/steps/email";
import { runGeneralStep } from "@/cli/wizard/steps/general";
import { runTelegramStep } from "@/cli/wizard/steps/telegram";

export async function runSetupCommand() {
  const prompter = createClackPrompter();
  const rootDir = process.cwd();
  const state = await loadCurrentConfig(rootDir);

  await prompter.intro("SubsTrack setup");
  await prompter.note(
    "This wizard keeps only bootstrap values in .env.local and seeds the rest into the Settings collection.",
    "How setup works"
  );

  await runDatabaseStep(prompter, state);
  await runAuthStep(prompter, state);
  await runEmailStep(prompter, state);
  await runTelegramStep(prompter, state);
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
