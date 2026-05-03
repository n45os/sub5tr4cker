import { redirect } from "next/navigation";

export default async function GroupBillingPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  redirect(`/dashboard/groups/${groupId}`);
}
