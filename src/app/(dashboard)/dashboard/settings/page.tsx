import { SettingsPageClient } from "@/components/features/settings/settings-page-client";
import { getAllSettings } from "@/lib/settings/service";

export default async function SettingsPage() {
  const settings = await getAllSettings();
  return <SettingsPageClient settings={settings} />;
}
