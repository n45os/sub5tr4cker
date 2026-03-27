import { NotificationsHubPageClient } from "@/components/features/notifications/notifications-hub-page-client";
import { getNotificationTemplates } from "@/lib/plugins/templates";
import { getAllSettings } from "@/lib/settings/service";

export default async function NotificationsPage() {
  const [templates, settings] = await Promise.all([
    Promise.resolve(getNotificationTemplates()),
    getAllSettings(),
  ]);

  return <NotificationsHubPageClient templates={templates} settings={settings} />;
}
