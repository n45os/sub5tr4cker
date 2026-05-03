// force the test process into a non-UTC zone before any imports so the local-time
// Date constructors used by the production code reflect a UTC+2 server (the
// production cron pod runs in Europe/Athens). Setting process.env.TZ here, prior
// to the first Date operation in this module, is the standard Node.js pattern
// for pinning the test timezone.
process.env.TZ = "Europe/Athens";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPeriodDates } from "@/lib/billing/calculator";
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

interface FakeStoreState {
  rows: StorageBillingPeriod[];
  auditCalls: Array<{ action: string; metadata?: Record<string, unknown> }>;
}

function installFakeStore(): FakeStoreState {
  const state: FakeStoreState = { rows: [], auditCalls: [] };

  const fakeStore: Partial<StorageAdapter> = {
    getBillingPeriodByStart: vi.fn(
      async (_groupId: string, periodStart: Date) =>
        state.rows.find(
          (r) => r.periodStart.getTime() === periodStart.getTime()
        ) ?? null
    ),
    getPeriodsForGroup: vi.fn(async (groupId: string) =>
      state.rows.filter((r) => r.groupId === groupId)
    ),
    logAudit: vi.fn(async (data) => {
      state.auditCalls.push({
        action: data.action as string,
        metadata: data.metadata as Record<string, unknown> | undefined,
      });
      return {
        id: "audit-stub",
        actorId: "",
        actorName: "",
        action: data.action,
        groupId: null,
        billingPeriodId: null,
        targetMemberId: null,
        metadata: {},
        createdAt: new Date(),
      };
    }),
    createBillingPeriod: vi.fn(async (data) => {
      const row: StorageBillingPeriod = {
        id: `row-${state.rows.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      state.rows.push(row);
      return row;
    }),
    updateBillingPeriod: vi.fn(async (id, patch) => {
      const idx = state.rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`row ${id} not found`);
      state.rows[idx] = {
        ...state.rows[idx],
        ...patch,
        updatedAt: new Date(),
      };
      return state.rows[idx];
    }),
  };

  vi.mocked(db).mockResolvedValue(fakeStore as StorageAdapter);
  return state;
}

function seedPeriod(
  state: FakeStoreState,
  group: StorageGroup,
  periodStart: Date,
  periodEnd: Date,
  label: string
) {
  state.rows.push({
    id: `row-preexisting-${state.rows.length + 1}`,
    groupId: group.id,
    periodStart,
    collectionOpensAt: periodStart,
    periodEnd,
    periodLabel: label,
    totalPrice: group.billing.currentPrice,
    currency: group.billing.currency,
    priceNote: null,
    payments: [],
    reminders: [],
    isFullyPaid: false,
    createdAt: periodStart,
    updatedAt: periodStart,
  });
}

describe("createPeriodIfDue — duplicate billing-period bug (phase 0 reproduction)", () => {
  let state: FakeStoreState;

  beforeEach(() => {
    state = installFakeStore();
  });

  it("does not insert a second 'May 2026' row when one already exists at canonical UTC midnight", async () => {
    const group = buildGroup();

    // pre-seed the canonical-UTC anchor that a prior cron run wrote when the
    // pod happened to run in UTC. periodStart should be a timezone-agnostic
    // anchor — May 1 00:00:00 UTC.
    seedPeriod(
      state,
      group,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-06-01T00:00:00.000Z"),
      "May 2026"
    );

    // cron tick fires just after the UTC boundary on May 1
    // (UTC: 2026-05-01T00:30:00Z, which is 03:30 local in EEST).
    // under the old local-time code, createPeriodIfDue called
    // getPeriodDates(2026, 4, 1) which used new Date(year, month, day) —
    // a local-time constructor — yielding local May 1 00:00 = UTC
    // 2026-04-30T21:00:00.000Z (EEST is UTC+3). The store lookup missed the
    // canonical-UTC anchor and a second "May 2026" row was inserted. With
    // UTC date math, getPeriodDates produces May 1 00:00 UTC, matching the
    // seeded canonical anchor and skipping the duplicate insert.
    await createPeriodIfDue(group, new Date("2026-05-01T00:30:00.000Z"));

    // root cause: src/lib/billing/calculator.ts → getPeriodDates uses the
    // local-time Date(year, month, day) constructor, so the period-start
    // anchor depends on the cron pod's TZ. The (group, periodStart) unique
    // index compares Date instants, not calendar months, so a TZ shift
    // between two cron runs (e.g. a redeploy that drops a TZ override)
    // bypasses dedup. Pinning the math to UTC (Date.UTC) keeps the anchor
    // identical across server timezones.
    expect(state.rows).toHaveLength(1);
    const mayRows = state.rows.filter((r) => r.periodLabel === "May 2026");
    expect(mayRows).toHaveLength(1);
    expect(mayRows[0].periodStart.toISOString()).toBe(
      "2026-05-01T00:00:00.000Z"
    );
  });
});

describe("createPeriodIfDue — boundary regression coverage", () => {
  let state: FakeStoreState;
  const baselineTZ = "Europe/Athens";

  beforeEach(() => {
    state = installFakeStore();
  });

  afterEach(() => {
    process.env.TZ = baselineTZ;
  });

  // every TZ in this matrix has a different offset, so a local-time anchor
  // would land on a different absolute instant for each. UTC-only math must
  // yield the same dedup outcome regardless of which zone the pod runs in.
  const tzMatrix = [
    "UTC",
    "Asia/Athens",
    "Pacific/Apia",
    "America/Los_Angeles",
  ];

  it.each(tzMatrix)(
    "no duplicate when cron tick lands at UTC end-of-month (TZ=%s)",
    async (tz) => {
      process.env.TZ = tz;
      const group = buildGroup();

      // pre-seed the April-2026 period at canonical UTC anchor.
      seedPeriod(
        state,
        group,
        new Date("2026-04-01T00:00:00.000Z"),
        new Date("2026-05-01T00:00:00.000Z"),
        "Apr 2026"
      );

      // cron tick at 23:30 UTC on April 30 — last 30 minutes of the UTC month.
      // local times by zone: Apia +13/+14 (well into May 1), Athens +3 (May 1
      // 02:30 EEST), LA -7 (April 30 16:30 PDT), UTC (April 30 23:30 itself).
      // a TZ-naive implementation would compute year/month from local time and
      // attempt to create a May period in Apia/Athens — duplicating any May row
      // or, here, creating a May row when only April was seeded. UTC accessors
      // pin the lookup to April for every zone, so no insert happens.
      await createPeriodIfDue(group, new Date("2026-04-30T23:30:00.000Z"));

      expect(state.rows).toHaveLength(1);
      expect(state.rows[0].periodLabel).toBe("Apr 2026");
    }
  );

  it("calling createPeriodIfDue twice in the same process tick is a no-op", async () => {
    const group = buildGroup();
    const now = new Date("2026-05-15T12:00:00.000Z");

    const firstCreated = await createPeriodIfDue(group, now);
    expect(firstCreated).toBe(true);
    expect(state.rows).toHaveLength(1);
    const firstId = state.rows[0].id;

    const secondCreated = await createPeriodIfDue(group, now);
    // month-based dedup short-circuits before any insert
    expect(secondCreated).toBe(false);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].id).toBe(firstId);
  });

  it("emits period_dedup_hit audit when a same-month row exists at a different instant", async () => {
    const group = buildGroup();

    // seed a May row whose periodStart is mid-month — same UTC calendar month
    // as what createPeriodIfDue will derive (May 1) but a different instant.
    seedPeriod(
      state,
      group,
      new Date("2026-05-15T00:00:00.000Z"),
      new Date("2026-06-15T00:00:00.000Z"),
      "May 2026"
    );

    await createPeriodIfDue(group, new Date("2026-05-20T12:00:00.000Z"));

    expect(state.rows).toHaveLength(1);
    const dedupHits = state.auditCalls.filter(
      (c) => c.action === "period_dedup_hit"
    );
    expect(dedupHits).toHaveLength(1);
    expect(dedupHits[0].metadata?.source).toBe("createPeriodIfDue");
  });
});

describe("getPeriodDates — TZ-invariance and edge-day behaviour", () => {
  const baselineTZ = "Europe/Athens";

  afterEach(() => {
    process.env.TZ = baselineTZ;
  });

  it("returns the same UTC instants regardless of process.env.TZ", () => {
    const tzs = ["UTC", "Asia/Athens", "Pacific/Apia", "America/Los_Angeles"];
    const results = tzs.map((tz) => {
      process.env.TZ = tz;
      return getPeriodDates(2026, 4, 1);
    });

    for (const r of results) {
      expect(r.start.toISOString()).toBe("2026-05-01T00:00:00.000Z");
      expect(r.end.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    }
  });

  it("handles leap-year Feb 29 cycleDay", () => {
    const { start, end } = getPeriodDates(2024, 1, 29);
    expect(start.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(end.toISOString()).toBe("2024-03-29T00:00:00.000Z");
  });

  // current behaviour: Date.UTC(year, month, 31) overflows into the next month
  // when the target month is shorter (Nov has 30 days → Dec 1). this pins the
  // overflow so any future change to clamp cycleDay to the month length must
  // intentionally update the assertion. clamping is a separate enhancement —
  // it is not required by the UTC-anchor fix and would change billing-period
  // semantics for groups whose cycleDay exceeds the calendar month length.
  it("cycleDay=31 in a 30-day month: overflows deterministically (current behaviour, pre-clamp)", () => {
    const { start, end } = getPeriodDates(2026, 10, 31);
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });
});
