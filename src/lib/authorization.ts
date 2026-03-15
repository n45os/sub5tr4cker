import type { Session } from "next-auth";
import type { IGroupMember } from "@/models";

type GroupMemberLike = {
  _id: { toString: () => string };
  email: string;
  nickname: string;
  role: string;
  customAmount?: number | null;
  user?: { toString: () => string } | null;
  acceptedAt?: Date | null;
  billingStartsAt?: Date | null;
  isActive?: boolean;
  leftAt?: Date | null;
};

type GroupLike = {
  _id: { toString: () => string };
  name: string;
  description: string | null;
  service: {
    name: string;
    icon: string | null;
    url: string | null;
    accentColor?: string | null;
  };
  billing: {
    mode: "equal_split" | "fixed_amount" | "variable";
    currentPrice: number;
    currency: string;
    cycleDay: number;
    cycleType: "monthly" | "yearly";
    adminIncludedInSplit: boolean;
    fixedMemberAmount?: number | null;
    gracePeriodDays: number;
  };
  payment: {
    platform: string;
    link: string | null;
    instructions: string | null;
  };
  notifications?: {
    remindersEnabled?: boolean;
    followUpsEnabled?: boolean;
    priceChangeEnabled?: boolean;
  };
  announcements?: {
    notifyOnPriceChange?: boolean;
  };
  initializedAt?: Date | null;
  isActive: boolean;
  admin: { toString: () => string };
  members: GroupMemberLike[];
};

type BillingPaymentLike = {
  memberId: { toString: () => string };
  memberNickname: string;
  amount: number;
  status: string;
  memberConfirmedAt?: Date | null;
  adminConfirmedAt?: Date | null;
};

type BillingPeriodLike = {
  _id: { toString: () => string };
  periodStart: Date;
  periodEnd?: Date;
  periodLabel: string;
  totalPrice: number;
  isFullyPaid: boolean;
  payments: BillingPaymentLike[];
};

export function isInstanceAdmin(session: Session | null): boolean {
  return session?.user?.role === "admin";
}

export function getGroupAccess(
  group: GroupLike,
  userId: string,
  userEmail: string
): "admin" | "member" | null {
  if (group.admin.toString() === userId) return "admin";
  const member = group.members.find(
    (m) =>
      m.isActive &&
      !m.leftAt &&
      (m.user?.toString() === userId || m.email === userEmail)
  );
  return member ? "member" : null;
}

export function getMemberEntry(
  group: Pick<GroupLike, "members">,
  userId: string,
  userEmail: string
): IGroupMember | null {
  const member =
    group.members.find(
      (m) =>
        m.isActive &&
        !m.leftAt &&
        (m.user?.toString() === userId || m.email === userEmail)
    ) ?? null;
  return member as unknown as IGroupMember | null;
}

export function filterGroupForMember(
  group: GroupLike,
  memberEntry: IGroupMember | null,
  access: "member" | "admin"
) {
  if (access === "admin") {
    return {
      _id: group._id.toString(),
      name: group.name,
      description: group.description,
      service: group.service,
      billing: group.billing,
      payment: group.payment,
      notifications: {
        remindersEnabled: group.notifications?.remindersEnabled ?? true,
        followUpsEnabled: group.notifications?.followUpsEnabled ?? true,
        priceChangeEnabled:
          group.notifications?.priceChangeEnabled ??
          group.announcements?.notifyOnPriceChange ??
          true,
      },
      isActive: group.isActive,
      initializedAt: group.initializedAt
        ? (group.initializedAt as Date).toISOString()
        : null,
      role: access,
      members: group.members
        .filter((m) => m.isActive && !m.leftAt)
        .map((m) => ({
          _id: m._id.toString(),
          email: m.email,
          nickname: m.nickname,
          role: m.role,
          customAmount: m.customAmount ?? null,
          hasAccount: !!m.user,
          acceptedAt: m.acceptedAt ? (m.acceptedAt as Date).toISOString() : null,
          billingStartsAt: m.billingStartsAt
            ? (m.billingStartsAt as Date).toISOString().slice(0, 10)
            : null,
        })),
    };
  }

  // member branch: memberEntry is guaranteed non-null (caller checks before calling with access "member")
  const me = memberEntry!;
  const activeMembers = group.members.filter((m) => m.isActive && !m.leftAt);
  return {
    _id: group._id.toString(),
    name: group.name,
    description: group.description,
    service: group.service,
    billing: group.billing,
    payment: group.payment,
    notifications: {
      remindersEnabled: group.notifications?.remindersEnabled ?? true,
      followUpsEnabled: group.notifications?.followUpsEnabled ?? true,
      priceChangeEnabled:
        group.notifications?.priceChangeEnabled ??
        group.announcements?.notifyOnPriceChange ??
        true,
    },
    isActive: group.isActive,
    initializedAt: group.initializedAt
      ? (group.initializedAt as Date).toISOString()
      : null,
    role: access,
    memberCount: activeMembers.length,
    myMembership: {
      _id: me._id.toString(),
      nickname: me.nickname,
      role: me.role,
      customAmount: me.customAmount ?? null,
      hasAccount: !!me.user,
      acceptedAt: me.acceptedAt
        ? (me.acceptedAt as Date).toISOString()
        : null,
      billingStartsAt: me.billingStartsAt
        ? (me.billingStartsAt as Date).toISOString().slice(0, 10)
        : null,
    },
  };
}

export function filterBillingForMember(
  periods: BillingPeriodLike[],
  memberId: string
) {
  return periods.map((period) => ({
    _id: period._id.toString(),
    periodStart: (period.periodStart as Date).toISOString().slice(0, 10),
    periodEnd: period.periodEnd
      ? (period.periodEnd as Date).toISOString().slice(0, 10)
      : undefined,
    periodLabel: period.periodLabel,
    totalPrice: period.totalPrice,
    isFullyPaid: period.isFullyPaid,
    payments: period.payments
      .filter((pay) => pay.memberId.toString() === memberId)
      .map((pay) => ({
        memberId: pay.memberId.toString(),
        memberNickname: pay.memberNickname,
        amount: pay.amount,
        status: pay.status,
        memberConfirmedAt: pay.memberConfirmedAt
          ? (pay.memberConfirmedAt as Date).toISOString()
          : null,
        adminConfirmedAt: pay.adminConfirmedAt
          ? (pay.adminConfirmedAt as Date).toISOString()
          : null,
      })),
  }));
}
