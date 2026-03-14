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
  groupId?: string;
  exp: number;
}

export async function createInviteLinkToken(
  memberId: string,
  _groupId: string,
  expiresInDays = 7
): Promise<string> {
  const expSec = Math.floor(
    (Date.now() + expiresInDays * 24 * 60 * 60 * 1000) / 1000
  );
  const exp = expSec.toString(36).padStart(7, "0");
  const data = `${memberId}${exp}`;
  const secret = await getTelegramLinkSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex")
    .slice(0, 12);
  return `${data}${signature}`;
}

export async function verifyInviteLinkToken(
  token: string
): Promise<InviteLinkPayload | null> {
  // support old payload format (<data>.<signature>) for previously sent emails
  if (token.includes(".")) {
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

  if (token.length < 43) return null;
  const memberId = token.slice(0, 24);
  const exp = token.slice(24, 31);
  const signature = token.slice(31);
  if (!/^[a-f0-9]{24}$/i.test(memberId)) return null;
  if (!/^[0-9a-z]{7}$/.test(exp)) return null;
  if (!/^[a-f0-9]{12}$/i.test(signature)) return null;

  const data = `${memberId}${exp}`;
  const secret = await getTelegramLinkSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex")
    .slice(0, 12);
  if (signature !== expectedSignature) return null;
  const expSec = parseInt(exp, 36);
  if (!Number.isFinite(expSec)) return null;
  if (Math.floor(Date.now() / 1000) > expSec) return null;
  return {
    memberId,
    exp: expSec * 1000,
  };
}

export interface InviteAcceptPayload {
  memberId: string;
  groupId: string;
  exp: number;
}

export async function createInviteAcceptToken(
  memberId: string,
  groupId: string,
  expiresInDays = 14
): Promise<string> {
  const payload: InviteAcceptPayload = {
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

export async function verifyInviteAcceptToken(
  token: string
): Promise<InviteAcceptPayload | null> {
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
    const payload: InviteAcceptPayload = JSON.parse(
      Buffer.from(data, "base64url").toString()
    );
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface MagicLoginPayload {
  userId: string;
  exp: number;
}

/** short-lived token for magic-link sign-in after accepting an invite (5 min) */
export async function createMagicLoginToken(
  userId: string,
  expiresInMinutes = 5
): Promise<string> {
  const payload: MagicLoginPayload = {
    userId,
    exp: Date.now() + expiresInMinutes * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await getConfirmationSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export async function verifyMagicLoginToken(
  token: string
): Promise<MagicLoginPayload | null> {
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
    const payload: MagicLoginPayload = JSON.parse(
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
