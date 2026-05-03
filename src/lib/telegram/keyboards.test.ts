import { describe, expect, it } from "vitest";

import {
  adminVerificationKeyboard,
  type AdminConfirmationMember,
} from "./keyboards";

const PERIOD_ID = "507f1f77bcf86cd799439011";
const GROUP_ID = "507f191e810c19729de860ea";
const APP_URL = "https://app.example.com";

function makeMembers(count: number): AdminConfirmationMember[] {
  return Array.from({ length: count }, (_, i) => ({
    // 24-char ids match Mongo ObjectId worst case for callback_data budget
    memberId: `5${i.toString().padStart(23, "0")}`,
    nickname: `Member ${i + 1}`,
  }));
}

function flatButtons(rows: unknown) {
  return (rows as Array<Array<Record<string, unknown>>>).flat();
}

describe("adminVerificationKeyboard", () => {
  it("renders one member row plus the trailing actions for a single member", () => {
    const kb = adminVerificationKeyboard({
      groupId: GROUP_ID,
      periodId: PERIOD_ID,
      unverifiedMembers: makeMembers(1),
      appUrl: APP_URL,
    });

    const rows = kb.inline_keyboard;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(2);
    expect(rows[0][0]).toMatchObject({
      text: "✅ Member",
      callback_data: `admin_confirm:${PERIOD_ID}:${makeMembers(1)[0].memberId}`,
    });
    expect(rows[0][1]).toMatchObject({
      text: "✕",
      callback_data: `admin_reject:${PERIOD_ID}:${makeMembers(1)[0].memberId}`,
    });
    expect(rows[1][0]).toMatchObject({
      text: "✅ Confirm all (1)",
      callback_data: `admin_confirm_all:${PERIOD_ID}`,
    });
    expect(rows[1][1]).toMatchObject({
      text: "🔗 Open",
      url: `${APP_URL}/dashboard/groups/${GROUP_ID}/billing`,
    });
  });

  it("renders three per-member rows plus the trailing actions row", () => {
    const kb = adminVerificationKeyboard({
      groupId: GROUP_ID,
      periodId: PERIOD_ID,
      unverifiedMembers: makeMembers(3),
      appUrl: APP_URL,
    });

    const rows = kb.inline_keyboard;
    expect(rows).toHaveLength(4);
    for (let i = 0; i < 3; i++) {
      expect(rows[i]).toHaveLength(2);
    }
    expect(rows[3][0]).toMatchObject({
      text: "✅ Confirm all (3)",
      callback_data: `admin_confirm_all:${PERIOD_ID}`,
    });
  });

  it("falls back to a single dashboard link when more than 8 members are unverified", () => {
    const kb = adminVerificationKeyboard({
      groupId: GROUP_ID,
      periodId: PERIOD_ID,
      unverifiedMembers: makeMembers(9),
      appUrl: APP_URL,
    });

    const rows = kb.inline_keyboard;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0]).toMatchObject({
      text: "Open dashboard",
      url: `${APP_URL}/dashboard/groups/${GROUP_ID}/billing`,
    });
    // no member-specific callback buttons in the fallback
    expect(JSON.stringify(rows)).not.toContain("admin_confirm:");
    expect(JSON.stringify(rows)).not.toContain("admin_reject:");
  });

  it("never produces a callback_data string longer than 64 bytes, including 24-char ids", () => {
    const kb = adminVerificationKeyboard({
      groupId: GROUP_ID,
      periodId: PERIOD_ID,
      unverifiedMembers: makeMembers(8),
      appUrl: APP_URL,
    });

    const buttons = flatButtons(kb.inline_keyboard);
    const callbackButtons = buttons.filter(
      (b): b is { text: string; callback_data: string } =>
        typeof (b as { callback_data?: unknown }).callback_data === "string"
    );
    expect(callbackButtons.length).toBeGreaterThan(0);
    for (const b of callbackButtons) {
      expect(Buffer.byteLength(b.callback_data, "utf8")).toBeLessThanOrEqual(64);
    }
  });

  it("omits the dashboard link when no app URL is configured", () => {
    const kb = adminVerificationKeyboard({
      groupId: GROUP_ID,
      periodId: PERIOD_ID,
      unverifiedMembers: makeMembers(2),
      appUrl: null,
    });

    const buttons = flatButtons(kb.inline_keyboard);
    expect(buttons.some((b) => "url" in b)).toBe(false);
    // confirm-all callback still present
    expect(
      buttons.some(
        (b) =>
          (b as { callback_data?: string }).callback_data ===
          `admin_confirm_all:${PERIOD_ID}`
      )
    ).toBe(true);
  });

  it("falls back without a dashboard button when over cap and no app URL is set", () => {
    const kb = adminVerificationKeyboard({
      groupId: GROUP_ID,
      periodId: PERIOD_ID,
      unverifiedMembers: makeMembers(9),
      appUrl: null,
    });
    expect(flatButtons(kb.inline_keyboard)).toEqual([]);
  });
});
