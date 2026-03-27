import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(),
}));

import { getSetting } from "@/lib/settings/service";
import { createInviteLinkToken, verifyInviteLinkToken } from "./tokens";

describe("invite link tokens", () => {
  beforeEach(() => {
    vi.mocked(getSetting).mockReset();
    vi.mocked(getSetting).mockResolvedValue(null);
  });

  it("creates and verifies versioned compact tokens for local-mode member ids", async () => {
    const memberId = "member_1234567890-abc";

    const token = await createInviteLinkToken(memberId, "group-1", 7);
    const payload = await verifyInviteLinkToken(token);

    expect(token.startsWith("v15")).toBe(true);
    expect(payload?.memberId).toBe(memberId);
    expect(payload?.exp).toBeGreaterThan(Date.now());
  });

  it("keeps supporting legacy compact tokens for mongo object ids", async () => {
    const memberId = "507f1f77bcf86cd799439011";
    const expSec = Math.floor(Date.now() / 1000) + 60 * 60;
    const exp = expSec.toString(36).padStart(7, "0");
    const data = `${memberId}${exp}`;
    const signature = crypto
      .createHmac("sha256", "dev-secret-change-me")
      .update(data)
      .digest("hex")
      .slice(0, 12);

    const payload = await verifyInviteLinkToken(`${data}${signature}`);

    expect(payload).toEqual({
      memberId,
      exp: expSec * 1000,
    });
  });
});
