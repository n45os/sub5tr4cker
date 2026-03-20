import type { IGroup } from "@/models";

const PLATFORM_LABEL: Record<IGroup["payment"]["platform"], string> = {
  revolut: "Revolut",
  paypal: "PayPal",
  bank_transfer: "Bank transfer",
  stripe: "Stripe",
  custom: "Custom",
};

/** plain-text block for Telegram (no HTML; safe for admin-entered instructions) */
export function formatGroupPaymentDetailsPlainText(
  group: Pick<IGroup, "name" | "payment" | "announcements">
): string {
  const platform =
    PLATFORM_LABEL[group.payment.platform] ?? group.payment.platform;
  const lines: string[] = [
    `💳 How to pay — ${group.name}`,
    "",
    `Platform: ${platform}`,
  ];

  const link = group.payment.link?.trim();
  if (link) {
    lines.push("", `Pay link: ${link}`);
  }

  const instructions = group.payment.instructions?.trim();
  if (instructions) {
    lines.push("", instructions);
  }

  const extra = group.announcements?.extraText?.trim();
  if (extra) {
    lines.push("", `Note from admin: ${extra}`);
  }

  if (!link && !instructions) {
    lines.push(
      "",
      "No payment link or instructions are set for this group yet. Ask your admin in the app if you need help."
    );
  }

  return lines.join("\n");
}
