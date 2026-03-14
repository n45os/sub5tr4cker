import { MongoClient } from "mongodb";
import type { WizardPrompter } from "@/cli/wizard/prompter";
import type { SetupState } from "@/cli/wizard/types";

export async function runDatabaseStep(
  prompter: WizardPrompter,
  state: SetupState
) {
  const mongoUri = await prompter.text({
    message: "MongoDB URI",
    initialValue: state.bootstrapEnv.MONGODB_URI,
    placeholder: "mongodb://localhost:27017/substrack",
    validate: (value) => {
      if (!value.trim()) {
        return "MongoDB URI is required";
      }

      if (!value.startsWith("mongodb://") && !value.startsWith("mongodb+srv://")) {
        return "Use a mongodb:// or mongodb+srv:// connection string";
      }
    },
  });

  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
    await client.db().command({ ping: 1 });
  } finally {
    await client.close().catch(() => undefined);
  }

  state.bootstrapEnv.MONGODB_URI = mongoUri;
}
