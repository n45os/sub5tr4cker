import { redirect } from "next/navigation";
import { SettingsPageClient } from "@/components/features/settings/settings-page-client";
import { auth } from "@/lib/auth";
import { isInstanceAdmin } from "@/lib/authorization";
import { getAllSettings } from "@/lib/settings/service";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !isInstanceAdmin(session)) {
    redirect("/dashboard");
  }
  const settings = await getAllSettings();
  return <SettingsPageClient settings={settings} />;
}
