import path from "path";
import type { SetupSection } from "@/cli/wizard/types";
import { createClackPrompter } from "@/cli/wizard/clack-prompter";
import { loadCurrentConfig, seedSettings, writeBootstrapEnv } from "@/cli/wizard/finalize";
import { runAuthStep } from "@/cli/wizard/steps/auth";
import { runDatabaseStep } from "@/cli/wizard/steps/database";
import { runEmailStep } from "@/cli/wizard/steps/email";
import { runGeneralStep } from "@/cli/wizard/steps/general";
import { runTelegramStep } from "@/cli/wizard/steps/telegram";

const sectionOptions: Array<{ value: SetupSection; label: string; hint: string }> = [
  {
    value: "database",
    label: "database",
    hint: "MongoDB connection string",
  },
  {
    value: "auth",
    label: "auth",
    hint: "NEXTAUTH secret and Google OAuth",
  },
  {
    value: "email",
    label: "email",
    hint: "Resend and sender details",
  },
  {
    value: "telegram",
    label: "telegram",
    hint: "Bot token and webhook secret",
  },
  {
    value: "general",
    label: "general",
    hint: "App URL and runtime defaults",
  },
];

export async function runConfigureCommand(section?: string) {
  const prompter = createClackPrompter();
  const rootDir = process.cwd();
  const state = await loadCurrentConfig(rootDir);

  const selectedSection =
    (section as SetupSection | undefined) ||
    (await prompter.select({
      message: "Which section do you want to configure?",
      options: sectionOptions,
    }));

  await prompter.intro(`SubsTrack configure: ${selectedSection}`);

  switch (selectedSection) {
    case "database":
      await runDatabaseStep(prompter, state);
      break;
    case "auth":
      await runAuthStep(prompter, state);
      break;
    case "email":
      await runEmailStep(prompter, state);
      break;
    case "telegram":
      await runTelegramStep(prompter, state);
      break;
    case "general":
      await runGeneralStep(prompter, state);
      break;
    default:
      throw new Error(`Unknown section: ${selectedSection}`);
  }

  await writeBootstrapEnv(rootDir, state);
  await seedSettings(rootDir, state);

  await prompter.outro(
    [
      `${selectedSection} configuration saved.`,
      `Bootstrap env updated at ${path.join(rootDir, ".env.local")}.`,
      "MongoDB settings updated successfully.",
    ].join("\n")
  );
}
