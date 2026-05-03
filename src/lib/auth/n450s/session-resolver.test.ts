import { describe, it, expect } from "vitest";
import { resolveSessionFromPayload } from "./session-resolver";
import type { N450sJwtPayload } from "./jwks";

describe("resolveSessionFromPayload", () => {
  it("maps a full payload to a Session with sub as user.id", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = {
      sub: "identity-123",
      iss: "n450s-auth",
      exp,
      email: "user@example.com",
      name: "User Person",
      picture: "https://example.com/avatar.png",
      role: "admin",
    } as N450sJwtPayload;

    const session = resolveSessionFromPayload(payload);

    expect(session.user.id).toBe("identity-123");
    expect(session.user.email).toBe("user@example.com");
    expect(session.user.name).toBe("User Person");
    expect(session.user.image).toBe("https://example.com/avatar.png");
    expect(session.user.role).toBe("admin");
    expect(new Date(session.expires).getTime()).toBe(exp * 1000);
  });

  it("defaults role to 'user' when missing", () => {
    const payload = {
      sub: "identity-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    } as N450sJwtPayload;
    const session = resolveSessionFromPayload(payload);
    expect(session.user.role).toBe("user");
  });

  it("returns nulls for absent profile fields rather than empty strings", () => {
    const payload = {
      sub: "identity-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    } as N450sJwtPayload;
    const session = resolveSessionFromPayload(payload);
    expect(session.user.email).toBeNull();
    expect(session.user.name).toBeNull();
    expect(session.user.image).toBeNull();
  });

  it("treats empty-string profile fields as null", () => {
    const payload = {
      sub: "identity-123",
      exp: Math.floor(Date.now() / 1000) + 60,
      email: "",
      name: "",
      picture: "",
    } as unknown as N450sJwtPayload;
    const session = resolveSessionFromPayload(payload);
    expect(session.user.email).toBeNull();
    expect(session.user.name).toBeNull();
    expect(session.user.image).toBeNull();
  });

  it("falls back to a near-future expiry when exp is missing", () => {
    const before = Date.now();
    const payload = { sub: "identity-123" } as N450sJwtPayload;
    const session = resolveSessionFromPayload(payload);
    const expiresMs = new Date(session.expires).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before);
    expect(expiresMs).toBeLessThanOrEqual(before + 120_000);
  });
});
