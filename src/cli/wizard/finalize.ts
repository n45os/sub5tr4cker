import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { MongoClient } from "mongodb";
import type { SetupState } from "@/cli/wizard/types";

export function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString("base64url");
}

export async function loadCurrentConfig(rootDir: string): Promise<SetupState> {
  const envPath = path.join(rootDir, ".env.local");
  const env = await readEnvFile(envPath);
  const mongoUri = env.MONGODB_URI || "mongodb://localhost:27017/substrack";

  const state: SetupState = {
    bootstrapEnv: {
      MONGODB_URI: mongoUri,
      NEXTAUTH_SECRET: env.NEXTAUTH_SECRET || generateSecret(),
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || "",
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || "",
      NODE_ENV: env.NODE_ENV || "development",
    },
    settings: {
      "general.appUrl": "http://localhost:3054",
      "email.apiKey": "",
      "email.fromAddress": "SubsTrack <noreply@substrack.app>",
      "telegram.botToken": "",
      "telegram.webhookSecret": "",
      "security.confirmationSecret": generateSecret(),
      "security.telegramLinkSecret": "",
      "security.cronSecret": generateSecret(),
    },
  };

  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    const docs = await client
      .db()
      .collection("settings")
      .find<Record<string, string | null>>({})
      .toArray();
    await client.close();

    for (const doc of docs) {
      if (typeof doc.key === "string" && typeof doc.value === "string") {
        if (doc.key in state.settings) {
          state.settings[doc.key as keyof SetupState["settings"]] = doc.value;
        }
      }
    }
  } catch {
    return state;
  }

  return state;
}

export async function writeBootstrapEnv(rootDir: string, state: SetupState) {
  const envPath = path.join(rootDir, ".env.local");
  const content = [
    "# bootstrap values kept in env",
    `MONGODB_URI=${state.bootstrapEnv.MONGODB_URI}`,
    `NEXTAUTH_SECRET=${state.bootstrapEnv.NEXTAUTH_SECRET}`,
    `GOOGLE_CLIENT_ID=${state.bootstrapEnv.GOOGLE_CLIENT_ID}`,
    `GOOGLE_CLIENT_SECRET=${state.bootstrapEnv.GOOGLE_CLIENT_SECRET}`,
    `NODE_ENV=${state.bootstrapEnv.NODE_ENV}`,
    "",
  ].join("\n");

  await fs.writeFile(envPath, content, "utf8");
}

export async function seedSettings(rootDir: string, state: SetupState) {
  const client = new MongoClient(state.bootstrapEnv.MONGODB_URI);
  await client.connect();

  const settingsCollection = client.db().collection("settings");
  const entries = Object.entries(state.settings);

  for (const [key, value] of entries) {
    const metadata = getSettingMetadata(key);
    await settingsCollection.updateOne(
      { key },
      {
        $set: {
          key,
          value: value || null,
          category: metadata.category,
          isSecret: metadata.isSecret,
          label: metadata.label,
          description: metadata.description,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  await client.close();

  await fs.mkdir(path.join(rootDir, ".cursor"), { recursive: true });
}

async function readEnvFile(filePath: string) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return Object.fromEntries(
      content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separatorIndex = line.indexOf("=");
          if (separatorIndex === -1) {
            return [line, ""];
          }

          return [
            line.slice(0, separatorIndex),
            line.slice(separatorIndex + 1),
          ];
        })
    );
  } catch {
    return {};
  }
}

function getSettingMetadata(key: string) {
  const metadata = {
    "general.appUrl": {
      category: "general",
      isSecret: false,
      label: "App URL",
      description: "Base URL used for links in emails, redirects, and callbacks.",
    },
    "email.apiKey": {
      category: "email",
      isSecret: true,
      label: "Resend API key",
      description: "API key used to send transactional emails through Resend.",
    },
    "email.fromAddress": {
      category: "email",
      isSecret: false,
      label: "From address",
      description: "Default sender shown on outgoing emails.",
    },
    "telegram.botToken": {
      category: "telegram",
      isSecret: true,
      label: "Telegram bot token",
      description: "BotFather token used to receive webhook updates and send messages.",
    },
    "telegram.webhookSecret": {
      category: "telegram",
      isSecret: true,
      label: "Telegram webhook secret",
      description: "Secret token used to validate webhook calls from Telegram.",
    },
    "security.confirmationSecret": {
      category: "security",
      isSecret: true,
      label: "Confirmation token secret",
      description: "Secret used to sign member payment confirmation links.",
    },
    "security.telegramLinkSecret": {
      category: "security",
      isSecret: true,
      label: "Telegram link secret",
      description: "Secret used to sign Telegram account-link tokens.",
    },
    "security.cronSecret": {
      category: "cron",
      isSecret: true,
      label: "Cron secret",
      description: "Shared secret required by protected cron endpoints.",
    },
  } as const;

  return metadata[key as keyof typeof metadata];
}
