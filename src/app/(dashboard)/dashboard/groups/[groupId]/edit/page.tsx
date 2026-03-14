import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { GroupForm } from "@/components/features/groups/group-form";
import { getServerBaseUrl } from "@/lib/server-url";

interface GroupDetailResponse {
  _id: string;
  name: string;
  description: string | null;
  service: { name: string; icon: string | null; url: string | null; accentColor: string | null };
  billing: {
    mode: "equal_split" | "fixed_amount" | "variable";
    currentPrice: number;
    currency: string;
    cycleDay: number;
    cycleType: "monthly" | "yearly";
    adminIncludedInSplit: boolean;
    gracePeriodDays: number;
    fixedMemberAmount: number | null;
  };
  payment: {
    platform: "revolut" | "paypal" | "bank_transfer" | "stripe" | "custom";
    link: string | null;
    instructions: string | null;
  };
}

async function getGroup(
  groupId: string,
  cookieHeader: string
): Promise<GroupDetailResponse | null> {
  const baseUrl = await getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/groups/${groupId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  return json.data ?? null;
}

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const cookieStore = await cookies();
  const group = await getGroup(groupId, cookieStore.toString());

  if (!group) {
    notFound();
  }

  return (
    <GroupForm
      mode="edit"
      groupId={groupId}
      initialValues={{
        name: group.name,
        description: group.description ?? "",
        serviceName: group.service.name,
        serviceIcon: group.service.icon ?? "",
        serviceUrl: group.service.url ?? "",
        serviceAccentColor: group.service.accentColor ?? "",
        billingMode: group.billing.mode,
        currentPrice: String(group.billing.currentPrice),
        currency: group.billing.currency,
        cycleDay: String(group.billing.cycleDay),
        cycleType: group.billing.cycleType,
        adminIncludedInSplit: group.billing.adminIncludedInSplit,
        gracePeriodDays: String(group.billing.gracePeriodDays),
        fixedMemberAmount: group.billing.fixedMemberAmount
          ? String(group.billing.fixedMemberAmount)
          : "",
        paymentPlatform: group.payment.platform,
        paymentLink: group.payment.link ?? "",
        paymentInstructions: group.payment.instructions ?? "",
      }}
    />
  );
}
