import { db } from "@/lib/storage";
import type { StorageUser } from "@/lib/storage/types";
import { getTelegramPlaceholderEmail } from "@/lib/users/placeholder-email";

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
  email?: string | null;
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

/**
 * resolve the User row that should control email/Telegram delivery for this payment.
 * prefers a candidate with telegram linked + telegram pref on (fixes profile-only TG link
 * where member.userId is still null, or stale userId without chatId).
 */
export async function resolveUserForReminder(params: {
  member?: MemberLike | null;
  payment: PaymentLike;
  /** from aggregated recipient — takes precedence over member.userId when set */
  memberUserIdOverride?: string | null;
}): Promise<StorageUser | null> {
  const { member, payment, memberUserIdOverride } = params;
  const store = await db();

  const fromMember =
    memberUserIdOverride && memberUserIdOverride !== ""
      ? memberUserIdOverride
      : member?.userId ?? (member?.user ? asId(member.user) : null) ?? null;

  const emailSet = new Set<string>();
  const addEmail = (e: string | null | undefined) => {
    const n = (e ?? "").trim().toLowerCase();
    if (n) emailSet.add(n);
  };
  addEmail(payment.memberEmail);
  addEmail(member?.email);
  // telegram-only invite users are keyed by synthetic email; billing rows may omit memberEmail
  addEmail(getTelegramPlaceholderEmail(asId(payment.memberId)));

  const seen = new Set<string>();
  const candidates: StorageUser[] = [];
  const push = (u: StorageUser | null) => {
    if (u && !seen.has(u.id)) {
      seen.add(u.id);
      candidates.push(u);
    }
  };

  if (fromMember) push(await store.getUser(fromMember));
  for (const email of emailSet) {
    push(await store.getUserByEmail(email));
  }

  for (const u of candidates) {
    if (u.telegram?.chatId && (u.notificationPreferences?.telegram ?? false)) {
      return u;
    }
  }
  return candidates[0] ?? null;
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
  let user: ReminderUserLike = params.user ?? null;
  if (!user) {
    const full = await resolveUserForReminder({ member, payment });
    user = full
      ? { telegram: full.telegram, notificationPreferences: full.notificationPreferences }
      : null;
  }

  const emailForReach =
    [payment.memberEmail, member?.email]
      .map((e) => (e ?? "").trim())
      .find((e) => e.length > 0) ?? null;

  const sendEmail =
    !!emailForReach &&
    !member?.unsubscribedFromEmail &&
    (user?.notificationPreferences?.email ?? true);
  const sendTelegram = !!(user?.telegram?.chatId && (user.notificationPreferences?.telegram ?? false));
  const skipReasons = getSkipReasons(member ?? undefined, user, sendEmail, sendTelegram);

  return {
    paymentId: payment.id ?? asId(payment._id),
    memberId: asId(payment.memberId),
    memberEmail: payment.memberEmail ?? member?.email ?? null,
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
