// force the test process into a non-UTC zone before any imports so the local-time
// Date constructors used by the production code reflect a UTC+2 server (the
// production cron pod runs in Europe/Athens). Setting process.env.TZ here, prior
// to the first Date operation in this module, is the standard Node.js pattern
// for pinning the test timezone.
process.env.TZ = "Europe/Athens";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPeriodIfDue } from "@/lib/billing/periods";
import type { StorageAdapter } from "@/lib/storage";
import type { StorageBillingPeriod, StorageGroup } from "@/lib/storage/types";

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>(
    "@/lib/storage"
  );
  return { ...actual, db: vi.fn() };
});

vi.mock("@/lib/tokens", () => ({
  createConfirmationToken: vi.fn(async () => "fake-token"),
}));

import { db } from "@/lib/storage";

function buildGroup(): StorageGroup {
  const epoch = new Date("2025-01-01T00:00:00.000Z");
  return {
    id: "group-netflix",
    name: "Netflix",
    description: null,
    adminId: "admin-1",
    service: {
      name: "Netflix",
      icon: null,
      url: null,
      accentColor: null,
      emailTheme: "clean",
    },
    billing: {
      mode: "equal_split",
      currentPrice: 20,
      currency: "EUR",
      cycleDay: 1,
      cycleType: "monthly",
      adminIncludedInSplit: false,
      fixedMemberAmount: null,
      gracePeriodDays: 3,
      paymentInAdvanceDays: 0,
    },
    payment: {
      platform: "revolut",
      link: null,
      instructions: null,
      stripeAccountId: null,
    },
    notifications: {
      remindersEnabled: true,
      followUpsEnabled: true,
      priceChangeEnabled: true,
      saveEmailParams: false,
    },
    members: [
      {
        id: "m1",
        userId: null,
        email: "alice@example.com",
        nickname: "Alice",
        role: "member",
        joinedAt: epoch,
        leftAt: null,
        isActive: true,
        customAmount: null,
        acceptedAt: epoch,
        unsubscribedFromEmail: false,
        billingStartsAt: null,
      },
    ],
    announcements: { notifyOnPriceChange: false, extraText: null },
    telegramGroup: { chatId: null, linkedAt: null },
    isActive: true,
    inviteCode: null,
    inviteLinkEnabled: false,
    initializedAt: epoch,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

describe("createPeriodIfDue — duplicate billing-period bug (phase 0 reproduction)", () => {
  let rows: StorageBillingPeriod[];

  beforeEach(() => {
    rows = [];

    const fakeStore: Partial<StorageAdapter> = {
      getBillingPeriodByStart: vi.fn(
        async (_groupId: string, periodStart: Date) => {
          return (
            rows.find(
              (r) => r.periodStart.getTime() === periodStart.getTime()
            ) ?? null
          );
        }
      ),
      createBillingPeriod: vi.fn(async (data) => {
        const row: StorageBillingPeriod = {
          id: `row-${rows.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        rows.push(row);
        return row;
      }),
      updateBillingPeriod: vi.fn(async (id, patch) => {
        const idx = rows.findIndex((r) => r.id === id);
        if (idx === -1) throw new Error(`row ${id} not found`);
        rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date() };
        return rows[idx];
      }),
    };

    vi.mocked(db).mockResolvedValue(fakeStore as StorageAdapter);
  });

  it("does not insert a second 'May 2026' row when one already exists at canonical UTC midnight", async () => {
    const group = buildGroup();

    // pre-seed the canonical-UTC anchor that a prior cron run wrote when the
    // pod happened to run in UTC. periodStart should be a timezone-agnostic
    // anchor — May 1 00:00:00 UTC.
    rows.push({
      id: "row-preexisting",
      groupId: group.id,
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      collectionOpensAt: new Date("2026-05-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-01T00:00:00.000Z"),
      periodLabel: "May 2026",
      totalPrice: 20,
      currency: "EUR",
      priceNote: null,
      payments: [],
      reminders: [],
      isFullyPaid: false,
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    // cron tick fires at 00:30 local on May 1 in TZ=Europe/Athens
    // (UTC: 2026-04-30T22:30:00Z). createPeriodIfDue calls
    // getPeriodDates(2026, 4, 1) which uses new Date(year, month, day) —
    // a local-time constructor — yielding local May 1 00:00 = UTC
    // 2026-04-30T22:00:00.000Z. The store lookup misses the canonical-UTC
    // anchor and a second "May 2026" row is inserted.
    await createPeriodIfDue(group, new Date("2026-04-30T22:30:00.000Z"));

    // root cause: src/lib/billing/calculator.ts → getPeriodDates uses the
    // local-time Date(year, month, day) constructor, so the period-start
    // anchor depends on the cron pod's TZ. The (group, periodStart) unique
    // index compares Date instants, not calendar months, so a TZ shift
    // between two cron runs (e.g. a redeploy that drops a TZ override)
    // bypasses dedup. Pinning the math to UTC (Date.UTC) keeps the anchor
    // identical across server timezones.
    expect(rows).toHaveLength(1);
    const mayRows = rows.filter((r) => r.periodLabel === "May 2026");
    expect(mayRows).toHaveLength(1);
    expect(mayRows[0].periodStart.toISOString()).toBe(
      "2026-05-01T00:00:00.000Z"
    );
  });
});
