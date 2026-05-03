import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import type { StorageAdapter } from "@/lib/storage";
import type {
  StorageAuditAction,
  StorageBillingPeriod,
  StorageGroup,
} from "@/lib/storage/types";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>(
    "@/lib/storage"
  );
  return { ...actual, db: vi.fn() };
});

vi.mock("@/lib/tokens", () => ({
  createConfirmationToken: vi.fn(async () => "fake-token"),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/storage";

import { POST } from "./route";

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

interface AuditCall {
  action: StorageAuditAction;
  metadata?: Record<string, unknown>;
}

interface FakeStoreState {
  rows: StorageBillingPeriod[];
  audits: AuditCall[];
  group: StorageGroup;
}

function installFakeStore(): FakeStoreState {
  const state: FakeStoreState = {
    rows: [],
    audits: [],
    group: buildGroup(),
  };

  const fakeStore: Partial<StorageAdapter> = {
    getGroup: vi.fn(async (id: string) =>
      id === state.group.id ? state.group : null
    ),
    getPeriodsForGroup: vi.fn(async (groupId: string) =>
      state.rows.filter((r) => r.groupId === groupId)
    ),
    getBillingPeriod: vi.fn(async (id: string, groupId: string) =>
      state.rows.find((r) => r.id === id && r.groupId === groupId) ?? null
    ),
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
    logAudit: vi.fn(async (data) => {
      state.audits.push({
        action: data.action,
        metadata: data.metadata as Record<string, unknown> | undefined,
      });
      return {
        id: `audit-${state.audits.length}`,
        actorId: data.actorId,
        actorName: data.actorName,
        action: data.action,
        groupId: data.groupId ?? null,
        billingPeriodId: data.billingPeriodId ?? null,
        targetMemberId: data.targetMemberId ?? null,
        metadata: data.metadata ?? {},
        createdAt: new Date(),
      };
    }),
  };

  vi.mocked(db).mockResolvedValue(fakeStore as StorageAdapter);

  vi.mocked(auth).mockResolvedValue({
    user: { id: "admin-1", email: "admin@example.com", name: "Admin" },
  } as never);

  return state;
}

function buildPostRequest(groupId: string, body: unknown): NextRequest {
  return new Request(`http://localhost/api/groups/${groupId}/billing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/groups/[groupId]/billing — month-based dedup", () => {
  let state: FakeStoreState;

  beforeEach(() => {
    state = installFakeStore();
  });

  it("a second POST for the same UTC month with a different periodStart instant returns the existing period and emits period_dedup_hit", async () => {
    const groupId = state.group.id;
    const ctx = { params: Promise.resolve({ groupId }) };

    // first POST: canonical UTC anchor for May 2026.
    const res1 = await POST(
      buildPostRequest(groupId, {
        periodLabel: "May 2026",
        totalPrice: 20,
        periodStart: "2026-05-01T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z",
      }),
      ctx
    );
    const json1 = await res1.json();

    expect(res1.status).toBe(200);
    expect(state.rows).toHaveLength(1);
    const firstId = state.rows[0].id;
    expect(json1.data._id).toBe(firstId);

    // second POST: same UTC calendar month (May 2026) but a different instant
    // — the only way this can happen in practice is a racing client or a
    // retry that picked a slightly different periodStart. month-based dedup
    // must collapse it to the first row instead of creating a duplicate.
    const res2 = await POST(
      buildPostRequest(groupId, {
        periodLabel: "May 2026",
        totalPrice: 20,
        periodStart: "2026-05-15T08:00:00.000Z",
        periodEnd: "2026-06-15T08:00:00.000Z",
      }),
      ctx
    );
    const json2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(state.rows).toHaveLength(1);
    expect(json2.data._id).toBe(firstId);

    // dedup audit fires when the candidate instant disagrees with the stored
    // one — that's the signal we want for spotting racing callers in prod.
    const dedupHits = state.audits.filter(
      (a) => a.action === "period_dedup_hit"
    );
    expect(dedupHits).toHaveLength(1);
    expect(dedupHits[0].metadata?.source).toBe(
      "POST /api/groups/[groupId]/billing"
    );
    expect(dedupHits[0].metadata?.existingPeriodStart).toBe(
      "2026-05-01T00:00:00.000Z"
    );
    expect(dedupHits[0].metadata?.candidatePeriodStart).toBe(
      "2026-05-15T08:00:00.000Z"
    );
  });

  it("a repeat POST with the same periodStart returns the existing period without emitting a dedup audit", async () => {
    const groupId = state.group.id;
    const ctx = { params: Promise.resolve({ groupId }) };
    const body = {
      periodLabel: "May 2026",
      totalPrice: 20,
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-06-01T00:00:00.000Z",
    };

    await POST(buildPostRequest(groupId, body), ctx);
    const res2 = await POST(buildPostRequest(groupId, body), ctx);
    const json2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(state.rows).toHaveLength(1);
    expect(json2.data._id).toBe(state.rows[0].id);

    // identical instants → no race signal, no dedup audit
    const dedupHits = state.audits.filter(
      (a) => a.action === "period_dedup_hit"
    );
    expect(dedupHits).toHaveLength(0);
  });
});
