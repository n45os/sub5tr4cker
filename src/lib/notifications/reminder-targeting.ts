import { db } from "@/lib/storage";

export type SkipReason =
  | "unsubscribed_from_email"
  | "email_pref_off"
  | "telegram_pref_off"
  | "no_telegram_link"
  | "no_reachable_channel";

export interface ReminderEligibility {
  paymentId: string;
  memberId: string;
  memberEmail: string | null;
  memberNickname: string;
  groupId: string;
  groupName: string;
  periodId: string;
  periodLabel: string;
  amount: number;
  currency: string;
  status: "pending" | "overdue";
  sendEmail: boolean;
  sendTelegram: boolean;
  skipReasons: SkipReason[];
}

type IdLike = { toString: () => string } | string;

type ReminderUserLike = {
  telegram?: { chatId: number | null } | null;
  notificationPreferences?: { email?: boolean; telegram?: boolean };
} | null | undefined;

type MemberLike = {
  id?: string;
  _id?: IdLike;
  userId?: string | null;
  user?: IdLike | null;
  unsubscribedFromEmail?: boolean;
};

type GroupLike = {
  id?: string;
  _id?: IdLike;
  name: string;
  members: MemberLike[];
};

type PeriodLike = {
  id?: string;
  _id?: IdLike;
  periodLabel: string;
  currency?: string;
};

export type PaymentLike = {
  id?: string;
  _id?: IdLike;
  memberId: IdLike;
  memberEmail: string | null;
  memberNickname: string;
  amount: number;
  status: string;
  confirmationToken?: string | null;
};

function asId(value: IdLike | undefined | null): string {
  return value == null ? "" : value.toString();
}

/** compute skip reasons for a single payment from member/user and resolved channel flags */
export function getSkipReasons(
  member: MemberLike | undefined,
  user: ReminderUserLike,
  sendEmail: boolean,
  sendTelegram: boolean
): SkipReason[] {
  const reasons: SkipReason[] = [];
  if (member?.unsubscribedFromEmail) reasons.push("unsubscribed_from_email");
  if (user) {
    if (user.notificationPreferences?.email === false) reasons.push("email_pref_off");
    if (!user.telegram?.chatId) reasons.push("no_telegram_link");
    else if (user.notificationPreferences?.telegram === false) reasons.push("telegram_pref_off");
  }
  if (!sendEmail && !sendTelegram) reasons.push("no_reachable_channel");
  return reasons;
}

/** compute whether we would send email/telegram for this payment (respects unsubscribe + user prefs) */
export async function getReminderEligibility(params: {
  group: GroupLike;
  period: PeriodLike;
  payment: PaymentLike;
  user?: ReminderUserLike;
}): Promise<ReminderEligibility> {
  const { group, period, payment } = params;
  const member = group.members.find(
    (m) => asId(m.id ?? m._id) === asId(payment.memberId)
  );
  let user = params.user;
  const memberUserId = member?.userId ?? asId(member?.user);
  if (!user && memberUserId) {
    const store = await db();
    const u = await store.getUser(memberUserId);
    user = u ? { telegram: u.telegram, notificationPreferences: u.notificationPreferences } : null;
  }

  const sendEmail =
    !!payment.memberEmail &&
    !member?.unsubscribedFromEmail &&
    (user?.notificationPreferences?.email ?? true);
  const sendTelegram = !!(user?.telegram?.chatId && (user.notificationPreferences?.telegram ?? false));
  const skipReasons = getSkipReasons(member ?? undefined, user, sendEmail, sendTelegram);

  return {
    paymentId: payment.id ?? asId(payment._id),
    memberId: asId(payment.memberId),
    memberEmail: payment.memberEmail,
    memberNickname: payment.memberNickname,
    groupId: group.id ?? asId(group._id),
    groupName: group.name,
    periodId: period.id ?? asId(period._id),
    periodLabel: period.periodLabel,
    amount: payment.amount,
    currency: period.currency || "EUR",
    status: payment.status as "pending" | "overdue",
    sendEmail,
    sendTelegram,
    skipReasons,
  };
}
