import type { WizardPrompter } from "@/cli/wizard/prompter";
import type { SetupState } from "@/cli/wizard/types";

export async function runEmailStep(
  prompter: WizardPrompter,
  state: SetupState
) {
  const enableEmail = await prompter.confirm({
    message: "Configure Resend email delivery now?",
    initialValue: !!state.settings["email.apiKey"],
  });

  if (!enableEmail) {
    state.settings["email.apiKey"] = "";
    return;
  }

  state.settings["email.apiKey"] = await prompter.text({
    message: "Resend API key",
    initialValue: state.settings["email.apiKey"],
    placeholder: "re_...",
    validate: (value) => (!value.trim() ? "Resend API key is required" : undefined),
  });

  state.settings["email.fromAddress"] = await prompter.text({
    message: "Default from address",
    initialValue: state.settings["email.fromAddress"],
    placeholder: "SubsTrack <noreply@yourdomain.com>",
    validate: (value) =>
      !value.trim() ? "From address is required" : undefined,
  });
}
