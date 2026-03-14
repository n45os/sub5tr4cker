import { dbConnect } from "@/lib/db/mongoose";
import { User } from "@/models";
import type { IGroup, IGroupMember } from "@/models";
import type { IMemberPayment, IBillingPeriod } from "@/models/billing-period";

export type SkipReason =
  | "unsubscribed_from_email"
  | "email_pref_off"
  | "telegram_pref_off"
  | "no_telegram_link"
  | "no_reachable_channel";

export interface ReminderEligibility {
  paymentId: string;
  memberId: string;
  memberEmail: string;
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

type GroupLike = Pick<
  IGroup,
  "_id" | "name" | "service" | "billing" | "payment" | "announcements" | "members"
> & { members: IGroupMember[] };

type PeriodLike = Pick<
  IBillingPeriod,
  "_id" | "periodLabel" | "currency"
>;

export type PaymentLike = Pick<
  IMemberPayment,
  "_id" | "memberId" | "memberEmail" | "memberNickname" | "amount" | "status" | "confirmationToken"
>;

/** compute skip reasons for a single payment from member/user and resolved channel flags */
export function getSkipReasons(
  member: IGroupMember | undefined,
  user: { telegram?: { chatId: number | null }; notificationPreferences?: { email?: boolean; telegram?: boolean } } | null | undefined,
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
  user?: { telegram?: { chatId: number | null }; notificationPreferences?: { email?: boolean; telegram?: boolean } } | null;
}): Promise<ReminderEligibility> {
  const { group, period, payment } = params;
  const member = group.members.find(
    (m) => m._id.toString() === (payment.memberId as { toString: () => string }).toString()
  );
  let user = params.user;
  if (!user && member?.user) {
    await dbConnect();
    const u = await User.findById(member.user).lean();
    user = u ? { telegram: u.telegram, notificationPreferences: u.notificationPreferences } : null;
  }

  const sendEmail = !member?.unsubscribedFromEmail && (user?.notificationPreferences?.email ?? true);
  const sendTelegram = !!(user?.telegram?.chatId && (user.notificationPreferences?.telegram ?? false));
  const skipReasons = getSkipReasons(member ?? undefined, user, sendEmail, sendTelegram);

  return {
    paymentId: (payment._id as { toString: () => string }).toString(),
    memberId: (payment.memberId as { toString: () => string }).toString(),
    memberEmail: payment.memberEmail,
    memberNickname: payment.memberNickname,
    groupId: (group._id as { toString: () => string }).toString(),
    groupName: group.name,
    periodId: (period._id as { toString: () => string }).toString(),
    periodLabel: period.periodLabel,
    amount: payment.amount,
    currency: period.currency || "EUR",
    status: payment.status as "pending" | "overdue",
    sendEmail,
    sendTelegram,
    skipReasons,
  };
}
