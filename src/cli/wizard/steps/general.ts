import { generateSecret } from "@/cli/wizard/finalize";
import type { WizardPrompter } from "@/cli/wizard/prompter";
import type { SetupState } from "@/cli/wizard/types";

export async function runGeneralStep(
  prompter: WizardPrompter,
  state: SetupState
) {
  state.settings["general.appUrl"] = await prompter.text({
    message: "App URL",
    initialValue: state.settings["general.appUrl"],
    placeholder: "http://localhost:3054",
    validate: (value) => {
      try {
        new URL(value);
        return undefined;
      } catch {
        return "Enter a valid URL";
      }
    },
  });

  state.bootstrapEnv.NODE_ENV = await prompter.select({
    message: "Node environment",
    initialValue: state.bootstrapEnv.NODE_ENV,
    options: [
      { value: "development", label: "development" },
      { value: "production", label: "production" },
    ],
  });

  if (!state.settings["security.confirmationSecret"]) {
    state.settings["security.confirmationSecret"] = generateSecret(24);
  }

  if (!state.settings["security.cronSecret"]) {
    state.settings["security.cronSecret"] = generateSecret(24);
  }
}
