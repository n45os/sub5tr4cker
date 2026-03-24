import { describe, it, expect } from "vitest";
import {
  getCollectionOpensAt,
  getFirstReminderEligibleAt,
  resolveCollectionOpensAt,
} from "./collection-window";

describe("getCollectionOpensAt", () => {
  it("subtracts whole days before period start", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const open = getCollectionOpensAt(start, 7);
    expect(open.toISOString()).toBe("2026-02-22T00:00:00.000Z");
  });
});

describe("getFirstReminderEligibleAt", () => {
  it("adds grace days after collection open", () => {
    const open = new Date("2026-02-22T00:00:00.000Z");
    const eligible = getFirstReminderEligibleAt(open, 3);
    expect(eligible.toISOString()).toBe("2026-02-25T00:00:00.000Z");
  });
});

describe("resolveCollectionOpensAt", () => {
  it("prefers stored collectionOpensAt", () => {
    const periodStart = new Date("2026-03-01T00:00:00.000Z");
    const collectionOpensAt = new Date("2026-02-22T00:00:00.000Z");
    expect(
      resolveCollectionOpensAt({ periodStart, collectionOpensAt }).toISOString()
    ).toBe(collectionOpensAt.toISOString());
  });

  it("falls back to periodStart when missing", () => {
    const periodStart = new Date("2026-03-01T00:00:00.000Z");
    expect(
      resolveCollectionOpensAt({ periodStart }).toISOString()
    ).toBe(periodStart.toISOString());
  });
});
