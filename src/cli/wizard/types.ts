export type SetupSection =
  | "database"
  | "auth"
  | "email"
  | "telegram"
  | "general";

export interface SetupState {
  bootstrapEnv: {
    MONGODB_URI: string;
    NEXTAUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    NODE_ENV: string;
  };
  settings: {
    "general.appUrl": string;
    "email.apiKey": string;
    "email.fromAddress": string;
    "telegram.botToken": string;
    "telegram.webhookSecret": string;
    "security.confirmationSecret": string;
    "security.telegramLinkSecret": string;
    "security.cronSecret": string;
  };
}
