/**
 * adapter conformance tests — same suite runs against SqliteAdapter.
 * MongooseAdapter is tested via integration tests that require a real MongoDB connection.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { rmSync, existsSync } from "fs";
import { SqliteAdapter } from "../sqlite-adapter";
import type { StorageAdapter } from "../adapter";

function makeTempDb(): string {
  return join(tmpdir(), `sub5tr4cker-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function buildGroupInput() {
  return {
    name: "YouTube Premium",
    description: "Family plan",
    adminId: "admin-1",
    service: {
      name: "YouTube Premium",
      icon: null,
      url: "https://youtube.com",
      accentColor: "#ff0000",
      emailTheme: "clean" as const,
    },
    billing: {
      mode: "equal_split" as const,
      currentPrice: 20,
      currency: "EUR",
      cycleDay: 1,
      cycleType: "monthly" as const,
      adminIncludedInSplit: true,
      fixedMemberAmount: null,
      gracePeriodDays: 3,
      paymentInAdvanceDays: 0,
    },
    payment: {
      platform: "revolut" as const,
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
        id: "member-1",
        userId: null,
        email: "alice@example.com",
        nickname: "Alice",
        role: "member" as const,
        joinedAt: new Date("2024-01-01"),
        leftAt: null,
        isActive: true,
        customAmount: null,
        acceptedAt: null,
        unsubscribedFromEmail: false,
        billingStartsAt: null,
      },
    ],
    announcements: { notifyOnPriceChange: true, extraText: null },
    telegramGroup: { chatId: null, linkedAt: null },
    isActive: true,
    inviteCode: "ABC123",
    inviteLinkEnabled: false,
    initializedAt: null,
  };
}

function buildPeriodInput(groupId: string) {
  const periodStart = new Date("2024-01-01");
  return {
    groupId,
    periodStart,
    collectionOpensAt: new Date("2024-01-01"),
    periodEnd: new Date("2024-01-31"),
    periodLabel: "January 2024",
    totalPrice: 20,
    currency: "EUR",
    priceNote: null,
    payments: [
      {
        id: "pay-1",
        memberId: "member-1",
        memberEmail: "alice@example.com",
        memberNickname: "Alice",
        amount: 10,
        adjustedAmount: null,
        adjustmentReason: null,
        status: "pending" as const,
        memberConfirmedAt: null,
        adminConfirmedAt: null,
        confirmationToken: "tok-abc",
        notes: null,
      },
    ],
    reminders: [],
    isFullyPaid: false,
  };
}

function runConformanceSuite(getAdapter: () => StorageAdapter) {
  describe("groups", () => {
    it("creates and retrieves a group", async () => {
      const adapter = getAdapter();
      const input = buildGroupInput();
      const created = await adapter.createGroup(input);
      expect(created.id).toBeTruthy();
      expect(created.name).toBe("YouTube Premium");
      expect(created.members).toHaveLength(1);

      const fetched = await adapter.getGroup(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe("YouTube Premium");
    });

    it("returns null for missing group", async () => {
      const adapter = getAdapter();
      const result = await adapter.getGroup("nonexistent-id");
      expect(result).toBeNull();
    });

    it("lists groups for user", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup({ ...buildGroupInput(), adminId: "user-xyz" });
      const list = await adapter.listGroupsForUser("user-xyz", "other@example.com");
      expect(list.some((gr) => gr.id === g.id)).toBe(true);
    });

    it("updates a group", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      const updated = await adapter.updateGroup(g.id, { name: "Netflix" });
      expect(updated.name).toBe("Netflix");
    });

    it("soft deletes a group", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      await adapter.softDeleteGroup(g.id);
      const fetched = await adapter.getGroup(g.id);
      expect(fetched!.isActive).toBe(false);
    });

    it("finds group by invite code", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup({ ...buildGroupInput(), inviteCode: "FINDME" });
      const found = await adapter.findGroupByInviteCode("FINDME");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(g.id);
    });
  });

  describe("billing periods", () => {
    it("creates and retrieves a billing period", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      const input = buildPeriodInput(g.id);
      const created = await adapter.createBillingPeriod(input);
      expect(created.id).toBeTruthy();
      expect(created.groupId).toBe(g.id);
      expect(created.payments).toHaveLength(1);

      const fetched = await adapter.getBillingPeriod(created.id, g.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.periodLabel).toBe("January 2024");
    });

    it("returns null for missing period", async () => {
      const adapter = getAdapter();
      const result = await adapter.getBillingPeriod("nope", "group-nope");
      expect(result).toBeNull();
    });

    it("gets open billing periods with collection window filter", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      const period = await adapter.createBillingPeriod({
        ...buildPeriodInput(g.id),
        collectionOpensAt: new Date("2023-12-01"),
      });
      const open = await adapter.getOpenBillingPeriods({
        asOf: new Date("2024-01-15"),
        unpaidOnly: true,
        groupIds: [g.id],
      });
      expect(open.some((p) => p.id === period.id)).toBe(true);
    });

    it("updates payment status", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      const period = await adapter.createBillingPeriod(buildPeriodInput(g.id));
      const updated = await adapter.updatePaymentStatus(period.id, "member-1", {
        status: "member_confirmed",
        memberConfirmedAt: new Date(),
      });
      expect(updated.payments[0].status).toBe("member_confirmed");
    });

    it("marks period fully paid when all payments confirmed", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      const period = await adapter.createBillingPeriod(buildPeriodInput(g.id));
      const updated = await adapter.updatePaymentStatus(period.id, "member-1", {
        status: "confirmed",
      });
      expect(updated.isFullyPaid).toBe(true);
    });

    it("finds period by confirmation token", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      const period = await adapter.createBillingPeriod(buildPeriodInput(g.id));
      const result = await adapter.getBillingPeriodByConfirmationToken("tok-abc");
      expect(result).not.toBeNull();
      expect(result!.period.id).toBe(period.id);
      expect(result!.paymentIndex).toBe(0);
    });

    it("deletes a billing period", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      const period = await adapter.createBillingPeriod(buildPeriodInput(g.id));
      await adapter.deleteBillingPeriod(period.id, g.id);
      const fetched = await adapter.getBillingPeriod(period.id, g.id);
      expect(fetched).toBeNull();
    });
  });

  describe("notifications", () => {
    it("logs and retrieves notifications", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      await adapter.logNotification({
        recipientEmail: "alice@example.com",
        recipientLabel: "alice@example.com",
        groupId: g.id,
        type: "payment_reminder",
        channel: "email",
        status: "sent",
        preview: "Please pay",
      });
      const notifs = await adapter.getNotificationsForGroup(g.id);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("payment_reminder");
    });
  });

  describe("scheduled tasks", () => {
    it("enqueues a task", async () => {
      const adapter = getAdapter();
      const task = await adapter.enqueueTask({
        type: "payment_reminder",
        runAt: new Date(Date.now() + 1000),
        payload: { groupId: "g1", billingPeriodId: "p1", memberId: "m1", paymentId: "pay1" },
        idempotencyKey: "test-key-unique-1",
      });
      expect(task).not.toBeNull();
      expect(task!.status).toBe("pending");
    });

    it("is idempotent (returns null on duplicate key)", async () => {
      const adapter = getAdapter();
      const key = "dup-key-test";
      await adapter.enqueueTask({
        type: "payment_reminder",
        runAt: new Date(),
        payload: { groupId: "g", billingPeriodId: "p", memberId: "m", paymentId: "pay" },
        idempotencyKey: key,
      });
      const second = await adapter.enqueueTask({
        type: "payment_reminder",
        runAt: new Date(),
        payload: { groupId: "g", billingPeriodId: "p", memberId: "m", paymentId: "pay" },
        idempotencyKey: key,
      });
      expect(second).toBeNull();
    });

    it("claims due tasks", async () => {
      const adapter = getAdapter();
      await adapter.enqueueTask({
        type: "payment_reminder",
        runAt: new Date(Date.now() - 1000),
        payload: { groupId: "g", billingPeriodId: "p", memberId: "m", paymentId: "pay2" },
        idempotencyKey: "claim-test-key",
      });
      const claimed = await adapter.claimTasks("worker-1", { limit: 5 });
      expect(claimed.some((t) => t.idempotencyKey === "claim-test-key")).toBe(true);
    });

    it("completes a task", async () => {
      const adapter = getAdapter();
      const task = await adapter.enqueueTask({
        type: "payment_reminder",
        runAt: new Date(Date.now() - 1000),
        payload: { groupId: "g", billingPeriodId: "p", memberId: "m", paymentId: "pay3" },
        idempotencyKey: "complete-test",
      });
      const [claimed] = await adapter.claimTasks("worker-1");
      if (claimed && claimed.idempotencyKey === "complete-test") {
        await adapter.completeTask(claimed.id);
        const counts = await adapter.getTaskCounts();
        expect(counts.completed).toBeGreaterThan(0);
      } else if (task) {
        await adapter.completeTask(task.id);
      }
    });
  });

  describe("price history", () => {
    it("creates and retrieves price history", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      await adapter.createPriceHistory({
        groupId: g.id,
        price: 25,
        previousPrice: 20,
        currency: "EUR",
        effectiveFrom: new Date("2024-06-01"),
        createdBy: "admin-1",
      });
      const history = await adapter.getPriceHistoryForGroup(g.id);
      expect(history).toHaveLength(1);
      expect(history[0].price).toBe(25);
    });
  });

  describe("export / import round-trip", () => {
    it("exports and imports data", async () => {
      const adapter = getAdapter();
      const g = await adapter.createGroup(buildGroupInput());
      await adapter.createBillingPeriod(buildPeriodInput(g.id));
      const bundle = await adapter.exportAll();
      expect(bundle.data.groups).toHaveLength(1);
      expect(bundle.data.billingPeriods).toHaveLength(1);
      expect(bundle.version).toBe("1.0.0");
      // import into a fresh adapter
      const dbPath2 = makeTempDb();
      const adapter2 = new SqliteAdapter(dbPath2);
      await adapter2.initialize();
      const result = await adapter2.importAll(bundle);
      expect(result.groups).toBe(1);
      expect(result.billingPeriods).toBe(1);
      expect(result.errors).toHaveLength(0);
      await adapter2.close();
      if (existsSync(dbPath2)) rmSync(dbPath2);
    });
  });
}

describe("SqliteAdapter", () => {
  let adapter: SqliteAdapter;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = makeTempDb();
    adapter = new SqliteAdapter(dbPath);
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
    if (existsSync(dbPath)) rmSync(dbPath);
  });

  runConformanceSuite(() => adapter);
});
