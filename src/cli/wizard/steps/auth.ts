import type { WizardPrompter } from "@/cli/wizard/prompter";
import type { SetupState } from "@/cli/wizard/types";
import { generateSecret } from "@/cli/wizard/finalize";

export async function runAuthStep(
  prompter: WizardPrompter,
  state: SetupState
) {
  const generateNewSecret = await prompter.confirm({
    message: "Generate a fresh NEXTAUTH_SECRET?",
    initialValue: !state.bootstrapEnv.NEXTAUTH_SECRET,
  });

  state.bootstrapEnv.NEXTAUTH_SECRET = generateNewSecret
    ? generateSecret()
    : await prompter.text({
        message: "NEXTAUTH_SECRET",
        initialValue: state.bootstrapEnv.NEXTAUTH_SECRET,
        validate: (value) =>
          value.trim().length < 16
            ? "Use a stronger secret (at least 16 characters)"
            : undefined,
      });

  state.bootstrapEnv.GOOGLE_CLIENT_ID = await prompter.text({
    message: "Google client ID (optional)",
    initialValue: state.bootstrapEnv.GOOGLE_CLIENT_ID,
    placeholder: "Leave blank to skip Google login",
  });

  state.bootstrapEnv.GOOGLE_CLIENT_SECRET = await prompter.text({
    message: "Google client secret (optional)",
    initialValue: state.bootstrapEnv.GOOGLE_CLIENT_SECRET,
    placeholder: "Leave blank to skip Google login",
  });
}
