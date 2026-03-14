import { describe, it, expect } from "vitest";
import { getSkipReasons } from "./reminder-targeting";

describe("getSkipReasons", () => {
  it("adds unsubscribed_from_email when member unsubscribed", () => {
    const member = { unsubscribedFromEmail: true } as never;
    const reasons = getSkipReasons(member, null, false, false);
    expect(reasons).toContain("unsubscribed_from_email");
  });

  it("adds email_pref_off when user has email pref false", () => {
    const user = { notificationPreferences: { email: false }, telegram: { chatId: 1 } };
    const reasons = getSkipReasons(undefined, user, false, false);
    expect(reasons).toContain("email_pref_off");
  });

  it("adds telegram_pref_off when user has telegram pref false", () => {
    const user = { notificationPreferences: { telegram: false }, telegram: { chatId: 1 } };
    const reasons = getSkipReasons(undefined, user, true, false);
    expect(reasons).toContain("telegram_pref_off");
  });

  it("adds no_telegram_link when user has no chatId", () => {
    const user = { notificationPreferences: { telegram: true }, telegram: { chatId: null } };
    const reasons = getSkipReasons(undefined, user, true, false);
    expect(reasons).toContain("no_telegram_link");
  });

  it("adds no_reachable_channel when both channels false", () => {
    const reasons = getSkipReasons(undefined, null, false, false);
    expect(reasons).toContain("no_reachable_channel");
  });

  it("returns empty when sendEmail true and no user", () => {
    const member = { unsubscribedFromEmail: false } as never;
    const reasons = getSkipReasons(member, null, true, false);
    expect(reasons).not.toContain("unsubscribed_from_email");
    expect(reasons).not.toContain("no_reachable_channel");
  });
});
