import type { Session } from "next-auth";
import { getSetting } from "@/lib/settings/service";

/** when members.user is populated (e.g. for admin payload), minimal user shape for channel status */
type PopulatedMemberUser = {
  telegram?: { chatId: number } | null;
  notificationPreferences?: { email?: boolean; telegram?: boolean } | null;
};

type IdLike = { toString: () => string } | string;

type GroupMemberLike = {
  id?: string;
  _id?: IdLike;
  email: string | null;
  nickname: string;
  role: string;
  customAmount?: number | null;
  userId?: string | null;
  user?: { toString: () => string } | PopulatedMemberUser | null;
  acceptedAt?: Date | null;
  billingStartsAt?: Date | null;
  isActive?: boolean;
  leftAt?: Date | null;
  unsubscribedFromEmail?: boolean;
};

type GroupLike = {
  id?: string;
  _id?: IdLike;
  name: string;
  description: string | null;
  service: {
    name: string;
    icon: string | null;
    url: string | null;
    accentColor?: string | null;
    emailTheme?: "clean" | "minimal" | "bold" | "rounded" | "corporate";
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
    paymentInAdvanceDays?: number;
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
    saveEmailParams?: boolean;
  };
  announcements?: {
    notifyOnPriceChange?: boolean;
  };
  initializedAt?: Date | null;
  isActive: boolean;
  adminId?: string;
  admin?: IdLike;
  members: GroupMemberLike[];
};

type BillingPaymentLike = {
  memberId: IdLike;
  memberNickname: string;
  amount: number;
  status: string;
  memberConfirmedAt?: Date | null;
  adminConfirmedAt?: Date | null;
};

type BillingPeriodLike = {
  id?: string;
  _id?: IdLike;
  periodStart: Date;
  periodEnd?: Date;
  periodLabel: string;
  totalPrice: number;
  isFullyPaid: boolean;
  payments: BillingPaymentLike[];
};

function asId(value: IdLike | undefined | null): string {
  return value == null ? "" : value.toString();
}

export function isInstanceAdmin(session: Session | null): boolean {
  return session?.user?.role === "admin";
}

export function getGroupAccess(
  group: GroupLike,
  userId: string,
  userEmail: string
): "admin" | "member" | null {
  if ((group.adminId ?? asId(group.admin)) === userId) return "admin";
  const member = group.members.find(
    (m) =>
      m.isActive &&
      !m.leftAt &&
      ((m.userId ?? asId(m.user as IdLike | undefined)) === userId ||
        (!!m.email && m.email === userEmail))
  );
  return member ? "member" : null;
}

export function getMemberEntry(
  group: Pick<GroupLike, "members">,
  userId: string,
  userEmail: string
): GroupMemberLike | null {
  const member =
    group.members.find(
      (m) =>
        m.isActive &&
        !m.leftAt &&
        ((m.userId ?? asId(m.user as IdLike | undefined)) === userId ||
          (!!m.email && m.email === userEmail))
    ) ?? null;
  return member;
}

export async function filterGroupForMember(
  group: GroupLike,
  memberEntry: GroupMemberLike | null,
  access: "member" | "admin"
) {
  if (access === "admin") {
    const emailEnabled = (await getSetting("email.enabled")) !== "false";

    return {
      _id: group.id ?? asId(group._id),
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
        saveEmailParams: group.notifications?.saveEmailParams ?? false,
      },
      isActive: group.isActive,
      initializedAt: group.initializedAt
        ? (group.initializedAt as Date).toISOString()
        : null,
      role: access,
      members: group.members
        .filter((m) => m.isActive && !m.leftAt)
        .map((m) => {
          const u =
            m.user &&
            typeof m.user === "object" &&
            "notificationPreferences" in (m.user as object)
              ? (m.user as PopulatedMemberUser)
              : null;
          const unsubscribed = (m as GroupMemberLike).unsubscribedFromEmail ?? false;
          return {
            _id: m.id ?? asId(m._id),
            email: m.email,
            nickname: m.nickname,
            role: m.role,
            customAmount: m.customAmount ?? null,
            hasAccount: !!m.user,
            acceptedAt: m.acceptedAt ? (m.acceptedAt as Date).toISOString() : null,
            billingStartsAt: m.billingStartsAt
              ? (m.billingStartsAt as Date).toISOString().slice(0, 10)
              : null,
            emailConnected:
              emailEnabled && !unsubscribed && (u?.notificationPreferences?.email ?? true),
            telegramConnected: !!(
              u?.telegram?.chatId &&
              (u?.notificationPreferences?.telegram ?? false)
            ),
            unsubscribedFromEmail: unsubscribed,
          };
        }),
    };
  }

  // member branch: memberEntry is guaranteed non-null (caller checks before calling with access "member")
  const me = memberEntry!;
  const activeMembers = group.members.filter((m) => m.isActive && !m.leftAt);
  return {
    _id: group.id ?? asId(group._id),
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
      saveEmailParams: group.notifications?.saveEmailParams ?? false,
    },
    isActive: group.isActive,
    initializedAt: group.initializedAt
      ? (group.initializedAt as Date).toISOString()
      : null,
    role: access,
    memberCount: activeMembers.length,
    myMembership: {
      _id: me.id ?? asId(me._id),
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
    _id: period.id ?? asId(period._id),
    periodStart: (period.periodStart as Date).toISOString().slice(0, 10),
    periodEnd: period.periodEnd
      ? (period.periodEnd as Date).toISOString().slice(0, 10)
      : undefined,
    periodLabel: period.periodLabel,
    totalPrice: period.totalPrice,
    isFullyPaid: period.isFullyPaid,
    payments: period.payments
      .filter((pay) => asId(pay.memberId) === memberId)
      .map((pay) => ({
        memberId: asId(pay.memberId),
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
