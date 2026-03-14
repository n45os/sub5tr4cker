import crypto from "crypto";

const SECRET = process.env.CONFIRMATION_SECRET || "dev-secret-change-me";

interface ConfirmationPayload {
  memberId: string;
  periodId: string;
  groupId: string;
  exp: number;
}

export function createConfirmationToken(
  memberId: string,
  periodId: string,
  groupId: string,
  expiresInDays = 7
): string {
  const payload: ConfirmationPayload = {
    memberId,
    periodId,
    groupId,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

export function verifyConfirmationToken(
  token: string
): ConfirmationPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", SECRET)
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

export function getConfirmationUrl(token: string): string {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/confirm/${token}`;
}

const LINK_SECRET = process.env.TELEGRAM_LINK_SECRET || process.env.CONFIRMATION_SECRET || "dev-secret-change-me";

export interface LinkPayload {
  userId: string;
  exp: number;
}

export function createLinkToken(userId: string, expiresInMinutes = 15): string {
  const payload: LinkPayload = {
    userId,
    exp: Date.now() + expiresInMinutes * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", LINK_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifyLinkToken(token: string): LinkPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", LINK_SECRET)
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
