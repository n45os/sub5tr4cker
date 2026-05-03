import type { StorageGroup, StorageGroupMember } from "@/lib/storage";

export interface MemberShare {
  memberId: string;
  email: string | null;
  nickname: string;
  amount: number;
}

// date when member's billing effectively starts (billingStartsAt or joinedAt)
function memberBillingStart(m: StorageGroupMember): Date {
  const d = m.billingStartsAt ?? m.joinedAt;
  return d instanceof Date ? d : (m.joinedAt as Date);
}

// calculate the share each active member owes for a given price
// when periodStart is set, only members whose billing has started by that date are included
export function calculateShares(
  group: StorageGroup,
  totalPrice?: number,
  periodStart?: Date
): MemberShare[] {
  const price = totalPrice ?? group.billing.currentPrice;
  let activeMembers = group.members.filter((m) => m.isActive && !m.leftAt);

  if (periodStart) {
    const start = periodStart.getTime();
    activeMembers = activeMembers.filter((m) => memberBillingStart(m).getTime() <= start);
  }

  if (activeMembers.length === 0) return [];

  switch (group.billing.mode) {
    case "equal_split":
      return calculateEqualSplit(group, activeMembers, price);
    case "fixed_amount":
      return calculateFixedAmount(group, activeMembers);
    case "variable":
      return calculateEqualSplit(group, activeMembers, price);
    default:
      return calculateEqualSplit(group, activeMembers, price);
  }
}

function calculateEqualSplit(
  group: StorageGroup,
  activeMembers: StorageGroupMember[],
  price: number
): MemberShare[] {
  // total people splitting = active external members + (admin if included)
  const splitCount =
    activeMembers.length + (group.billing.adminIncludedInSplit ? 1 : 0);

  if (splitCount === 0) return [];

  const sharePerPerson = price / splitCount;

  return activeMembers.map((member) => ({
    memberId: member.id,
    email: member.email,
    nickname: member.nickname,
    amount: round2(member.customAmount ?? sharePerPerson),
  }));
}

function calculateFixedAmount(
  group: StorageGroup,
  activeMembers: StorageGroupMember[]
): MemberShare[] {
  const fixedAmount = group.billing.fixedMemberAmount ?? 0;

  return activeMembers.map((member) => ({
    memberId: member.id,
    email: member.email,
    nickname: member.nickname,
    amount: round2(member.customAmount ?? fixedAmount),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// format a date as a period label like "Mar 2026"
export function formatPeriodLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// get the billing period start/end dates for a given month
// anchors are UTC-midnight so the same (year, month, cycleDay) yields the same
// Date instant regardless of the server's local timezone
export function getPeriodDates(
  year: number,
  month: number,
  cycleDay: number
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month, cycleDay));
  const end = new Date(Date.UTC(year, month + 1, cycleDay));
  return { start, end };
}

// next period start date from today (for display in group list)
export function getNextPeriodStart(cycleDay: number): Date {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  const day = now.getUTCDate();
  if (day >= cycleDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return new Date(Date.UTC(year, month, cycleDay));
}
