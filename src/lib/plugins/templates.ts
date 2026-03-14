import {
  getNotificationTemplatePreview as getBuiltInPreview,
  getNotificationTemplates as getBuiltInTemplates,
  type NotificationTemplatePreview,
  type NotificationTemplateType,
} from "@/lib/email/templates";
import { getPluginTemplates } from "./loader";

const BUILT_IN_TYPES = new Set<NotificationTemplateType>([
  "payment_reminder",
  "admin_confirmation_request",
  "price_change",
  "invite",
]);

export type { NotificationTemplatePreview, NotificationTemplateType };

export function getNotificationTemplatePreview(
  type: string
): NotificationTemplatePreview | null {
  if (BUILT_IN_TYPES.has(type as NotificationTemplateType)) {
    return getBuiltInPreview(type as NotificationTemplateType);
  }
  if (type.startsWith("plugin:")) {
    const parts = type.slice(7).split(":");
    const [pluginSlug, templateId] = parts;
    if (!pluginSlug || !templateId) return null;
    return getPluginTemplatePreview(pluginSlug, templateId);
  }
  return null;
}

function getPluginTemplatePreview(
  pluginSlug: string,
  templateId: string
): NotificationTemplatePreview | null {
  const registrations = getPluginTemplates().filter(
    (t) => t.pluginSlug === pluginSlug && t.id === templateId
  );
  const reg = registrations[0];
  if (!reg) return null;

  try {
    const mod = require(reg.resolvedFile);
    const buildMessage = mod.buildMessage ?? mod.default?.buildMessage;
    const sampleParams = mod.sampleParams ?? mod.default?.sampleParams;
    const metadata = mod.metadata ?? mod.default?.metadata ?? {};
    if (typeof buildMessage !== "function" || !sampleParams) return null;

    const built = buildMessage(sampleParams);
    const subject =
      typeof built?.subject === "string" ? built.subject : reg.name;
    const emailHtml = typeof built?.html === "string" ? built.html : "";
    const telegramText = typeof built?.text === "string" ? built.text : "";

    return {
      type: `plugin:${pluginSlug}:${templateId}`,
      name: metadata.name ?? reg.name,
      description: metadata.description ?? reg.description ?? "",
      subject,
      channels: ["email", "telegram"],
      variables: Array.isArray(metadata.variables) ? metadata.variables : [],
      emailHtml,
      telegramText,
    } as unknown as NotificationTemplatePreview;
  } catch {
    return null;
  }
}

export function getNotificationTemplates(): NotificationTemplatePreview[] {
  const builtIn = getBuiltInTemplates();
  const pluginRegistrations = getPluginTemplates();
  const pluginPreviews: NotificationTemplatePreview[] = [];

  for (const reg of pluginRegistrations) {
    const type = `plugin:${reg.pluginSlug}:${reg.id}`;
    const preview = getPluginTemplatePreview(reg.pluginSlug, reg.id);
    if (preview) pluginPreviews.push(preview);
  }

  return [...builtIn, ...pluginPreviews];
}
