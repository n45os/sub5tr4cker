import type {
  StorageBillingPeriod,
  StorageGroup,
  StorageGroupMember,
  StorageUser,
} from "@/lib/storage/types";
import { calculateShares, formatPeriodLabel } from "@/lib/billing/calculator";
import { formatGroupPaymentDetailsPlainText } from "@/lib/telegram/payment-details-text";

function memberEffectiveStart(member: StorageGroupMember): Date {
  const d = member.billingStartsAt ?? member.joinedAt;
  return d instanceof Date ? d : new Date(d as string);
}

function cycleLabel(group: StorageGroup): string {
  const { cycleType, cycleDay } = group.billing;
  if (cycleType === "yearly") {
    return `yearly (renewal day: ${cycleDay})`;
  }
  return `monthly (renewal day: ${cycleDay} of each month)`;
}

/** condensed payment summary for welcome (full block can be long) */
function formatPaymentSummaryShort(
  group: Pick<StorageGroup, "name" | "payment" | "announcements">
): string {
  const full = formatGroupPaymentDetailsPlainText(group);
  const maxLen = 1200;
  if (full.length <= maxLen) return full;
  return full.slice(0, maxLen - 1) + "…";
}

/**
 * rich welcome after a member accepts an invite on Telegram — billing,
 * payment details, and command hints
 */
export function buildTelegramInviteWelcomeText(
  group: StorageGroup,
  member: StorageGroupMember
): string {
  const shares = calculateShares(group);
  const mine = shares.find((s) => s.memberId === member.id);
  const shareLine =
    mine != null
      ? `Your share: ${mine.amount.toFixed(2)} ${group.billing.currency} per ${
          group.billing.cycleType === "yearly" ? "year" : "month"
        }`
      : "Your share: (ask your admin if this looks wrong)";

  const totalLine = `${group.billing.currentPrice.toFixed(2)} ${
    group.billing.currency
  } total per ${group.billing.cycleType === "yearly" ? "year" : "month"} — ${
    group.billing.mode === "equal_split"
      ? `split across the group (admin ${group.billing.adminIncludedInSplit ? "included" : "not included"} in split)`
      : group.billing.mode === "fixed_amount"
        ? "fixed amount per member"
        : "variable split"
  }`;

  const start = memberEffectiveStart(member);
  const startLine = `Your share applies from ${start.toISOString().slice(0, 10)} (${formatPeriodLabel(start)} cycle).`;

  const payBlock = formatPaymentSummaryShort(group);

  return [
    "✅ Account linked!",
    "",
    `${group.service.name} — ${group.name}`,
    "",
    shareLine,
    totalLine,
    startLine,
    "",
    `Billing: ${cycleLabel(group)}`,
    "",
    payBlock,
    "",
    "What happens next:",
    "• When a collection opens and you owe something, reminders arrive here.",
    "• Use the buttons on those messages to mark paid or open payment details.",
    "",
    "Commands:",
    "/services — your subscriptions and current payment status",
    "/help — how this bot works",
  ].join("\n");
}

export function buildEmailSignInFooter(): string {
  return "\n\nWe also emailed you a secure link to open the member dashboard in a browser.";
}

/** after linking from profile (link code), no group context */
export function buildTelegramProfileLinkSuccessText(): string {
  return [
    "✅ Telegram connected to your sub5tr4cker account.",
    "",
    "You'll get payment reminders here when your groups send them.",
    "",
    "Commands:",
    "/services — your subscriptions and current payment status",
    "/help — how this bot works",
  ].join("\n");
}

export function buildTelegramHelpText(): string {
  return [
    "sub5tr4cker bot — help",
    "",
    "• Payment reminders show what you owe and may include buttons:",
    "  — mark that you paid",
    "  — payment details (link, instructions)",
    "  — snooze (when offered)",
    "",
    "• Admins get separate buttons to confirm or reject a member payment claim.",
    "",
    "Commands:",
    "/services — list your groups, typical share, and open period status",
    "/help — this message",
    "",
    "If you're new, open the invite link your admin sent (starts with /start invite_…).",
  ].join("\n");
}

function formatPaymentStatusLabel(status: StorageBillingPeriod["payments"][number]["status"]): string {
  switch (status) {
    case "pending":
      return "unpaid";
    case "overdue":
      return "overdue";
    case "member_confirmed":
      return "waiting for admin confirmation";
    case "confirmed":
      return "paid (confirmed)";
    case "waived":
      return "waived";
    default:
      return status;
  }
}

function findMembershipForUser(group: StorageGroup, user: StorageUser): StorageGroupMember | undefined {
  return group.members.find(
    (m) =>
      m.isActive &&
      !m.leftAt &&
      (m.userId === user.id ||
        (!!m.email && m.email.toLowerCase() === user.email.toLowerCase()))
  );
}

/**
 * multi-group summary for /services
 */
export function buildServicesCommandText(
  user: StorageUser,
  groups: StorageGroup[],
  openPeriods: StorageBillingPeriod[]
): string {
  const periodByGroup = new Map<string, StorageBillingPeriod[]>();
  for (const p of openPeriods) {
    const list = periodByGroup.get(p.groupId) ?? [];
    list.push(p);
    periodByGroup.set(p.groupId, list);
  }
  for (const list of periodByGroup.values()) {
    list.sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime());
  }

  const lines: string[] = ["📋 Your subscriptions", ""];

  for (const g of groups) {
    const me = findMembershipForUser(g, user);
    const isAdmin = g.adminId === user.id;

    lines.push(`• ${g.service.name} — ${g.name}`);

    if (me) {
      const shares = calculateShares(g);
      const share = shares.find((s) => s.memberId === me.id);
      if (share) {
        lines.push(
          `  Typical share: ${share.amount.toFixed(2)} ${g.billing.currency} / ${
            g.billing.cycleType === "yearly" ? "yr" : "mo"
          }`
        );
      }
      const periods = periodByGroup.get(g.id) ?? [];
      const latest = periods[0];
      if (latest) {
        const pay = latest.payments.find((p) => p.memberId === me.id);
        if (pay) {
          lines.push(
            `  Open period ${latest.periodLabel}: ${formatPaymentStatusLabel(pay.status)} — ${pay.amount.toFixed(2)} ${latest.currency}`
          );
        } else {
          lines.push(
            `  Open period ${latest.periodLabel}: no payment line for you (ask your admin if you expected one)`
          );
        }
      } else {
        lines.push("  No open billing period right now.");
      }
    } else if (isAdmin) {
      lines.push("  You're the admin (not in the member split list for this summary).");
    } else {
      lines.push("  Could not match your membership — contact your admin.");
    }
    lines.push("");
  }

  lines.push("Commands: /help");
  const text = lines.join("\n");
  const max = 4000;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20)}…\n(trimmed — too many groups)`;
}
