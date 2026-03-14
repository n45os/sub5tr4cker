import { describe, it, expect } from "vitest";
import { buildIdempotencyKey } from "./idempotency";

describe("buildIdempotencyKey", () => {
  it("builds payment_reminder key with period, payment, and date", () => {
    const runAt = new Date("2026-03-18T10:00:00Z");
    const key = buildIdempotencyKey("payment_reminder", {
      groupId: "g1",
      billingPeriodId: "p1",
      paymentId: "pay1",
    }, runAt);
    expect(key).toBe("payment_reminder:p1:pay1:2026-03-18");
  });

  it("builds admin_confirmation_request key with group, period, and date", () => {
    const runAt = new Date("2026-03-18T14:00:00Z");
    const key = buildIdempotencyKey("admin_confirmation_request", {
      groupId: "g1",
      billingPeriodId: "p1",
    }, runAt);
    expect(key).toBe("admin_confirmation_request:g1:p1:2026-03-18");
  });

  it("uses same date for same day regardless of time", () => {
    const runAt1 = new Date("2026-03-18T00:00:00Z");
    const runAt2 = new Date("2026-03-18T23:59:59Z");
    const key1 = buildIdempotencyKey("payment_reminder", {
      groupId: "g1",
      billingPeriodId: "p1",
      paymentId: "pay1",
    }, runAt1);
    const key2 = buildIdempotencyKey("payment_reminder", {
      groupId: "g1",
      billingPeriodId: "p1",
      paymentId: "pay1",
    }, runAt2);
    expect(key1).toBe(key2);
  });

  it("produces different key for different day", () => {
    const runAt1 = new Date("2026-03-18T10:00:00Z");
    const runAt2 = new Date("2026-03-19T10:00:00Z");
    const key1 = buildIdempotencyKey("payment_reminder", {
      groupId: "g1",
      billingPeriodId: "p1",
      paymentId: "pay1",
    }, runAt1);
    const key2 = buildIdempotencyKey("payment_reminder", {
      groupId: "g1",
      billingPeriodId: "p1",
      paymentId: "pay1",
    }, runAt2);
    expect(key1).not.toBe(key2);
    expect(key2).toBe("payment_reminder:p1:pay1:2026-03-19");
  });
});
