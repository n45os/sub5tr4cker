import crypto from "crypto";
import { getSetting } from "@/lib/settings/service";

interface ConfirmationPayload {
  memberId: string;
  periodId: string;
  groupId: string;
  exp: number;
}

async function getConfirmationSecret() {
  return (
    (await getSetting("security.confirmationSecret")) || "dev-secret-change-me"
  );
}

async function getTelegramLinkSecret() {
  return (
    (await getSetting("security.telegramLinkSecret")) ||
    (await getSetting("security.confirmationSecret")) ||
    "dev-secret-change-me"
  );
}

export async function createConfirmationToken(
  memberId: string,
  periodId: string,
  groupId: string,
  expiresInDays = 7
): Promise<string> {
  const payload: ConfirmationPayload = {
    memberId,
    periodId,
    groupId,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await getConfirmationSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

export async function verifyConfirmationToken(
  token: string
): Promise<ConfirmationPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const secret = await getConfirmationSecret();

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  if (signature !== expectedSignature) return null;

  try {
    const payload: ConfirmationPayload = JSON.parse(
      Buffer.from(data, "base64url").toString()
    );

    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function getConfirmationUrl(token: string): Promise<string> {
  const baseUrl =
    (await getSetting("general.appUrl")) || "http://localhost:3054";
  return `${baseUrl}/api/confirm/${token}`;
}

export interface LinkPayload {
  userId: string;
  exp: number;
}

export async function createLinkToken(
  userId: string,
  expiresInMinutes = 15
): Promise<string> {
  const payload: LinkPayload = {
    userId,
    exp: Date.now() + expiresInMinutes * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await getTelegramLinkSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export async function verifyLinkToken(token: string): Promise<LinkPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const secret = await getTelegramLinkSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  if (signature !== expectedSignature) return null;
  try {
    const payload: LinkPayload = JSON.parse(
      Buffer.from(data, "base64url").toString()
    );
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface InviteLinkPayload {
  memberId: string;
  groupId: string;
  exp: number;
}

export async function createInviteLinkToken(
  memberId: string,
  groupId: string,
  expiresInDays = 7
): Promise<string> {
  const payload: InviteLinkPayload = {
    memberId,
    groupId,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await getTelegramLinkSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export async function verifyInviteLinkToken(
  token: string
): Promise<InviteLinkPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const secret = await getTelegramLinkSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  if (signature !== expectedSignature) return null;
  try {
    const payload: InviteLinkPayload = JSON.parse(
      Buffer.from(data, "base64url").toString()
    );
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface UnsubscribePayload {
  memberId: string;
  groupId: string;
  exp: number;
}

export async function createUnsubscribeToken(
  memberId: string,
  groupId: string,
  expiresInDays = 365
): Promise<string> {
  const payload: UnsubscribePayload = {
    memberId,
    groupId,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await getConfirmationSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export async function verifyUnsubscribeToken(
  token: string
): Promise<UnsubscribePayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const secret = await getConfirmationSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  if (signature !== expectedSignature) return null;
  try {
    const payload: UnsubscribePayload = JSON.parse(
      Buffer.from(data, "base64url").toString()
    );
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getUnsubscribeUrl(token: string): Promise<string> {
  const baseUrl =
    (await getSetting("general.appUrl")) || "http://localhost:3054";
  return `${baseUrl}/api/unsubscribe/${token}`;
}
