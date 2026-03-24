import { describe, it, expect } from "vitest";
import {
  aggregateOutstandingByGroupFromPeriods,
  buildAdminBillingSnapshot,
} from "./billing-snapshot";

describe("aggregateOutstandingByGroupFromPeriods", () => {
  it("sums outstanding rows across multiple periods for the same group", () => {
    const periods = [
      {
        group: "g1",
        payments: [{ status: "pending" }, { status: "confirmed" }],
      },
      {
        group: "g1",
        payments: [{ status: "overdue" }],
      },
    ];
    const map = aggregateOutstandingByGroupFromPeriods(periods);
    const g1 = map.get("g1");
    expect(g1?.outstandingPaymentCount).toBe(2);
    expect(g1?.pendingCount).toBe(1);
    expect(g1?.overdueCount).toBe(1);
    expect(g1?.memberConfirmedCount).toBe(0);
  });

  it("counts member_confirmed without pending or overdue", () => {
    const periods = [
      {
        group: "g1",
        payments: [{ status: "member_confirmed" }],
      },
    ];
    const map = aggregateOutstandingByGroupFromPeriods(periods);
    const g1 = map.get("g1");
    expect(g1?.outstandingPaymentCount).toBe(1);
    expect(g1?.memberConfirmedCount).toBe(1);
    expect(g1?.pendingCount).toBe(0);
    expect(g1?.overdueCount).toBe(0);
  });
});

describe("buildAdminBillingSnapshot", () => {
  it("counts groups needing attention vs reminder-eligible separately", () => {
    const byGroup = aggregateOutstandingByGroupFromPeriods([
      {
        group: "g1",
        payments: [{ status: "member_confirmed" }],
      },
      {
        group: "g2",
        payments: [{ status: "pending" }],
      },
    ]);

    const snap = buildAdminBillingSnapshot(["g1", "g2", "g3"], byGroup);
    expect(snap.totalGroups).toBe(3);
    expect(snap.groupsNeedingAttention).toBe(2);
    expect(snap.groupsEligibleForReminders).toBe(1);
    expect(snap.pendingCount).toBe(1);
    expect(snap.overdueCount).toBe(0);
    expect(snap.memberConfirmedCount).toBe(1);
  });

  it("returns zeros when no admin group has outstanding payments", () => {
    const byGroup = new Map();
    const snap = buildAdminBillingSnapshot(["a", "b"], byGroup);
    expect(snap.groupsNeedingAttention).toBe(0);
    expect(snap.groupsEligibleForReminders).toBe(0);
    expect(snap.pendingCount).toBe(0);
  });
});
