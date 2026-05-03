import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import type { CryptoKey } from "jose";
import { verifyAccessToken, __setJwksForTests } from "./jwks";
import { __resetN450sAuthConfigForTests } from "./config";

const ISSUER = "n450s-auth";
const CLIENT_ID = "sub5tr4cker";
const AUDIENCE = `service:${CLIENT_ID}`;

describe("verifyAccessToken", () => {
  let privateKey: CryptoKey;
  let publicKey: CryptoKey;

  beforeEach(async () => {
    process.env.AUTH_SERVICE_URL = "http://auth.test";
    process.env.OAUTH_CLIENT_ID = CLIENT_ID;
    process.env.OAUTH_CLIENT_SECRET = "secret";
    process.env.OAUTH_REDIRECT_URIS = "http://localhost:3054/api/auth/n450s/callback";
    __resetN450sAuthConfigForTests();

    const kp = await generateKeyPair("RS256");
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
    __setJwksForTests(async () => publicKey);
  });

  afterEach(() => {
    __setJwksForTests(null);
    __resetN450sAuthConfigForTests();
  });

  async function signToken(
    claims: Record<string, unknown>,
    opts: { expSecondsFromNow?: number; iatSecondsAgo?: number; key?: CryptoKey } = {}
  ): Promise<string> {
    const iat = Math.floor(Date.now() / 1000) - (opts.iatSecondsAgo ?? 0);
    const exp = iat + (opts.expSecondsFromNow ?? 3600);
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(opts.key ?? privateKey);
  }

  it("accepts a valid token and returns the payload", async () => {
    const token = await signToken({
      sub: "identity-123",
      iss: ISSUER,
      aud: AUDIENCE,
      role: "member",
    });
    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe("identity-123");
    expect(payload.role).toBe("member");
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await signToken({
      sub: "identity-123",
      iss: "evil-auth",
      aud: AUDIENCE,
    });
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("rejects a token with the wrong audience", async () => {
    const token = await signToken({
      sub: "identity-123",
      iss: ISSUER,
      aud: "service:other-client",
    });
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await signToken(
      { sub: "identity-123", iss: ISSUER, aud: AUDIENCE },
      { iatSecondsAgo: 7200, expSecondsFromNow: -3600 }
    );
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("rejects a token signed by an unknown key", async () => {
    const other = await generateKeyPair("RS256");
    const token = await signToken(
      { sub: "identity-123", iss: ISSUER, aud: AUDIENCE },
      { key: other.privateKey }
    );
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });
});
