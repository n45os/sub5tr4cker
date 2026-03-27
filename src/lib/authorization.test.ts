import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(),
}));

import { getSetting } from "@/lib/settings/service";
import { filterGroupForMember } from "./authorization";

describe("filterGroupForMember", () => {
  beforeEach(() => {
    vi.mocked(getSetting).mockReset();
  });

  it("hides email connected when workspace email is disabled", async () => {
    vi.mocked(getSetting).mockResolvedValue("false");

    const payload = await filterGroupForMember(
      {
        id: "group-1",
        name: "Test group",
        description: null,
        service: {
          name: "Netflix",
          icon: null,
          url: null,
        },
        billing: {
          mode: "equal_split",
          currentPrice: 10,
          currency: "EUR",
          cycleDay: 1,
          cycleType: "monthly",
          adminIncludedInSplit: false,
          gracePeriodDays: 0,
        },
        payment: {
          platform: "revolut",
          link: null,
          instructions: null,
        },
        notifications: {},
        announcements: {},
        initializedAt: null,
        isActive: true,
        adminId: "admin-1",
        members: [
          {
            id: "member-1",
            email: "member@example.com",
            nickname: "Member",
            role: "member",
            isActive: true,
            user: {
              notificationPreferences: {
                email: true,
                telegram: true,
              },
              telegram: {
                chatId: 123,
              },
            },
          },
        ],
      },
      null,
      "admin"
    );

    expect(payload.members[0]?.emailConnected).toBe(false);
    expect(payload.members[0]?.telegramConnected).toBe(true);
  });

  it("keeps email connected when workspace email is enabled", async () => {
    vi.mocked(getSetting).mockResolvedValue("true");

    const payload = await filterGroupForMember(
      {
        id: "group-1",
        name: "Test group",
        description: null,
        service: {
          name: "Netflix",
          icon: null,
          url: null,
        },
        billing: {
          mode: "equal_split",
          currentPrice: 10,
          currency: "EUR",
          cycleDay: 1,
          cycleType: "monthly",
          adminIncludedInSplit: false,
          gracePeriodDays: 0,
        },
        payment: {
          platform: "revolut",
          link: null,
          instructions: null,
        },
        notifications: {},
        announcements: {},
        initializedAt: null,
        isActive: true,
        adminId: "admin-1",
        members: [
          {
            id: "member-1",
            email: "member@example.com",
            nickname: "Member",
            role: "member",
            isActive: true,
            user: {
              notificationPreferences: {
                email: true,
                telegram: false,
              },
              telegram: null,
            },
          },
        ],
      },
      null,
      "admin"
    );

    expect(payload.members[0]?.emailConnected).toBe(true);
    expect(payload.members[0]?.telegramConnected).toBe(false);
  });
});
