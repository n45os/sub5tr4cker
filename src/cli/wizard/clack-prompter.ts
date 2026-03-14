import {
  cancel,
  confirm,
  intro,
  isCancel,
  note,
  outro,
  select,
  text,
} from "@clack/prompts";
import type { WizardPrompter } from "@/cli/wizard/prompter";

function unwrapCancelled<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  return value as T;
}

export function createClackPrompter(): WizardPrompter {
  return {
    async intro(title) {
      intro(title);
    },
    async outro(message) {
      outro(message);
    },
    async note(message, title) {
      note(message, title);
    },
    async text(params) {
      const value = await text({
        message: params.message,
        placeholder: params.placeholder,
        initialValue: params.initialValue,
        validate: params.validate
          ? (input) => params.validate?.(input ?? "")
          : undefined,
      });

      return unwrapCancelled<string>(value);
    },
    async select(params) {
      const value = await select({
        message: params.message,
        initialValue: params.initialValue,
        options: params.options,
      });

      return unwrapCancelled<string>(value);
    },
    async confirm(params) {
      const value = await confirm({
        message: params.message,
        initialValue: params.initialValue,
      });

      return unwrapCancelled<boolean>(value);
    },
  };
}
