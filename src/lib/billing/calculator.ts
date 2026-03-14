import { IGroup, IGroupMember } from "@/models";

export interface MemberShare {
  memberId: string;
  email: string;
  nickname: string;
  amount: number;
}

// calculate the share each active member owes for a given price
export function calculateShares(
  group: IGroup,
  totalPrice?: number
): MemberShare[] {
  const price = totalPrice ?? group.billing.currentPrice;
  const activeMembers = group.members.filter((m) => m.isActive && !m.leftAt);

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
  group: IGroup,
  activeMembers: IGroupMember[],
  price: number
): MemberShare[] {
  // total people splitting = active external members + (admin if included)
  const splitCount =
    activeMembers.length + (group.billing.adminIncludedInSplit ? 1 : 0);

  if (splitCount === 0) return [];

  const sharePerPerson = price / splitCount;

  return activeMembers.map((member) => ({
    memberId: member._id.toString(),
    email: member.email,
    nickname: member.nickname,
    amount: round2(member.customAmount ?? sharePerPerson),
  }));
}

function calculateFixedAmount(
  group: IGroup,
  activeMembers: IGroupMember[]
): MemberShare[] {
  const fixedAmount = group.billing.fixedMemberAmount ?? 0;

  return activeMembers.map((member) => ({
    memberId: member._id.toString(),
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
export function getPeriodDates(
  year: number,
  month: number,
  cycleDay: number
): { start: Date; end: Date } {
  const start = new Date(year, month, cycleDay);
  const end = new Date(year, month + 1, cycleDay);
  return { start, end };
}
