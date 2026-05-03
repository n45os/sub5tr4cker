import crypto from "crypto";
import { getSetting } from "@/lib/settings/service";

const INVITE_LINK_EXP_LENGTH = 7;
const INVITE_LINK_SIGNATURE_LENGTH = 12;
const INVITE_LINK_LENGTH_PREFIX_LENGTH = 2;
const INVITE_LINK_TOKEN_VERSION = "v";
const LEGACY_INVITE_LINK_MEMBER_ID_LENGTH = 24;

interface ConfirmationPayload {
  memberId: string;
  periodId: string;
  groupId: string;
  exp: number;
}

async function getConfirmationSecret() {
  const fromSettings = await getSetting("security.confirmationSecret");
  if (fromSettings) return fromSettings;
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "dev-secret-change-me"
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

type ParsedCompactInviteLinkToken = {
  memberId: string;
  exp: string;
  signature: string;
  data: string;
};

function signInviteLinkData(data: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex").slice(0, 12);
}

function parseVersionedInviteLinkToken(token: string): ParsedCompactInviteLinkToken | null {
  if (!token.startsWith(INVITE_LINK_TOKEN_VERSION)) return null;

  const body = token.slice(INVITE_LINK_TOKEN_VERSION.length);
  const minimumLength =
    INVITE_LINK_LENGTH_PREFIX_LENGTH +
    1 +
    INVITE_LINK_EXP_LENGTH +
    INVITE_LINK_SIGNATURE_LENGTH;

  if (body.length < minimumLength) return null;

  const memberIdLengthHex = body.slice(0, INVITE_LINK_LENGTH_PREFIX_LENGTH);
  if (!/^[a-f0-9]{2}$/i.test(memberIdLengthHex)) return null;

  const memberIdLength = parseInt(memberIdLengthHex, 16);
  if (!Number.isFinite(memberIdLength) || memberIdLength < 1) return null;

  const expectedBodyLength =
    INVITE_LINK_LENGTH_PREFIX_LENGTH +
    memberIdLength +
    INVITE_LINK_EXP_LENGTH +
    INVITE_LINK_SIGNATURE_LENGTH;

  if (body.length !== expectedBodyLength) return null;

  const memberIdStart = INVITE_LINK_LENGTH_PREFIX_LENGTH;
  const memberIdEnd = memberIdStart + memberIdLength;
  const expEnd = memberIdEnd + INVITE_LINK_EXP_LENGTH;
  const memberId = body.slice(memberIdStart, memberIdEnd);
  const exp = body.slice(memberIdEnd, expEnd);
  const signature = body.slice(expEnd);

  if (!memberId) return null;
  if (!/^[0-9a-z]{7}$/.test(exp)) return null;
  if (!/^[a-f0-9]{12}$/i.test(signature)) return null;

  return {
    memberId,
    exp,
    signature,
    data: `${INVITE_LINK_TOKEN_VERSION}${memberIdLengthHex}${memberId}${exp}`,
  };
}

function parseLegacyInviteLinkToken(token: string): ParsedCompactInviteLinkToken | null {
  const minimumLength = LEGACY_INVITE_LINK_MEMBER_ID_LENGTH + INVITE_LINK_EXP_LENGTH;
  if (token.length < minimumLength + INVITE_LINK_SIGNATURE_LENGTH) return null;

  const memberId = token.slice(0, token.length - INVITE_LINK_EXP_LENGTH - INVITE_LINK_SIGNATURE_LENGTH);
  const exp = token.slice(
    token.length - INVITE_LINK_EXP_LENGTH - INVITE_LINK_SIGNATURE_LENGTH,
    token.length - INVITE_LINK_SIGNATURE_LENGTH
  );
  const signature = token.slice(token.length - INVITE_LINK_SIGNATURE_LENGTH);

  if (memberId.length !== LEGACY_INVITE_LINK_MEMBER_ID_LENGTH) return null;
  if (!/^[a-f0-9]{24}$/i.test(memberId)) return null;
  if (!/^[0-9a-z]{7}$/.test(exp)) return null;
  if (!/^[a-f0-9]{12}$/i.test(signature)) return null;

  return {
    memberId,
    exp,
    signature,
    data: `${memberId}${exp}`,
  };
}

function parseCompactInviteLinkToken(token: string): ParsedCompactInviteLinkToken | null {
  return parseVersionedInviteLinkToken(token) ?? parseLegacyInviteLinkToken(token);
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
  if (memberId.length > 0xff) {
    throw new Error("member id is too long for invite link token");
  }
  const memberIdLengthHex = memberId.length.toString(16).padStart(2, "0");
  const data = `${INVITE_LINK_TOKEN_VERSION}${memberIdLengthHex}${memberId}${exp}`;
  const secret = await getTelegramLinkSecret();
  const signature = signInviteLinkData(data, secret);
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

  const parsed = parseCompactInviteLinkToken(token);
  if (!parsed) return null;

  const secret = await getTelegramLinkSecret();
  const expectedSignature = signInviteLinkData(parsed.data, secret);
  if (parsed.signature !== expectedSignature) return null;
  const expSec = parseInt(parsed.exp, 36);
  if (!Number.isFinite(expSec)) return null;
  if (Math.floor(Date.now() / 1000) > expSec) return null;
  return {
    memberId: parsed.memberId,
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

/** short-lived token for magic-link sign-in after accepting an invite (30 min) */
export async function createMagicLoginToken(
  userId: string,
  expiresInMinutes = 30
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

export interface MemberPortalPayload {
  memberId: string;
  groupId: string;
  exp: number;
}

export async function createMemberPortalToken(
  memberId: string,
  groupId: string,
  expiresInDays = 90
): Promise<string> {
  const payload: MemberPortalPayload = {
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

export async function verifyMemberPortalToken(
  token: string
): Promise<MemberPortalPayload | null> {
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
    const payload: MemberPortalPayload = JSON.parse(
      Buffer.from(data, "base64url").toString()
    );
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getMemberPortalUrl(token: string): Promise<string> {
  const baseUrl =
    (await getSetting("general.appUrl")) || "http://localhost:3054";
  return `${baseUrl}/member/${token}`;
}
