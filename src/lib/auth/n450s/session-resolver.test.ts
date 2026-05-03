import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSessionFromPayload } from "./session-resolver";
import type { N450sJwtPayload } from "./jwks";
import type { StorageUser } from "@/lib/storage/types";

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>(
    "@/lib/storage"
  );
  return { ...actual, db: vi.fn() };
});

import { db } from "@/lib/storage";

function fakeUser(overrides: Partial<StorageUser> = {}): StorageUser {
  return {
    id: "local-user-1",
    name: "Local User",
    email: "local@example.com",
    authIdentityId: "identity-123",
    role: "user",
    emailVerified: null,
    image: null,
    hashedPassword: null,
    telegram: null,
    telegramLinkCode: null,
    notificationPreferences: {
      email: true,
      telegram: false,
      reminderFrequency: "every_3_days",
    },
    welcomeEmailSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as StorageUser;
}

function mockStoreWith(user: StorageUser | null) {
  vi.mocked(db).mockResolvedValue({
    getUserByAuthIdentityId: vi.fn().mockResolvedValue(user),
  } as unknown as Awaited<ReturnType<typeof db>>);
}

describe("resolveSessionFromPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps a payload to a Session keyed by local User._id, not sub", async () => {
    mockStoreWith(fakeUser({ id: "local-abc", role: "admin" }));
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

    const session = await resolveSessionFromPayload(payload);

    expect(session).not.toBeNull();
    expect(session!.user.id).toBe("local-abc");
    expect(session!.user.email).toBe("user@example.com");
    expect(session!.user.name).toBe("User Person");
    expect(session!.user.image).toBe("https://example.com/avatar.png");
    expect(session!.user.role).toBe("admin");
    expect(new Date(session!.expires).getTime()).toBe(exp * 1000);
  });

  it("returns null when no local user is linked to the sub", async () => {
    mockStoreWith(null);
    const payload = {
      sub: "identity-orphan",
      exp: Math.floor(Date.now() / 1000) + 60,
    } as N450sJwtPayload;
    const session = await resolveSessionFromPayload(payload);
    expect(session).toBeNull();
  });

  it("falls back to local user fields when payload omits them", async () => {
    mockStoreWith(
      fakeUser({
        email: "fallback@example.com",
        name: "Fallback Name",
        image: "https://example.com/fallback.png",
        role: "user",
      })
    );
    const payload = {
      sub: "identity-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    } as N450sJwtPayload;
    const session = await resolveSessionFromPayload(payload);
    expect(session!.user.email).toBe("fallback@example.com");
    expect(session!.user.name).toBe("Fallback Name");
    expect(session!.user.image).toBe("https://example.com/fallback.png");
    expect(session!.user.role).toBe("user");
  });

  it("treats empty-string payload fields as missing and uses local user values", async () => {
    mockStoreWith(
      fakeUser({
        email: "fallback@example.com",
        name: "Fallback Name",
        image: null,
      })
    );
    const payload = {
      sub: "identity-123",
      exp: Math.floor(Date.now() / 1000) + 60,
      email: "",
      name: "",
      picture: "",
    } as unknown as N450sJwtPayload;
    const session = await resolveSessionFromPayload(payload);
    expect(session!.user.email).toBe("fallback@example.com");
    expect(session!.user.name).toBe("Fallback Name");
    expect(session!.user.image).toBeNull();
  });

  it("falls back to a near-future expiry when exp is missing", async () => {
    mockStoreWith(fakeUser());
    const before = Date.now();
    const payload = { sub: "identity-123" } as N450sJwtPayload;
    const session = await resolveSessionFromPayload(payload);
    const expiresMs = new Date(session!.expires).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before);
    expect(expiresMs).toBeLessThanOrEqual(before + 120_000);
  });
});
