import { z } from "zod";

// schema for plugin manifest (substrack-plugin.json)

const configFieldSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
});

const templateEntrySchema = z.object({
  file: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

const channelEntrySchema = z.object({
  file: z.string().min(1),
  name: z.string().min(1),
  configSchema: z.record(z.string(), configFieldSchema).optional(),
});

export const pluginManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  provides: z
    .object({
      templates: z.array(z.string()).optional(),
      channels: z.array(z.string()).optional(),
    })
    .optional(),
  templates: z.record(z.string(), templateEntrySchema).optional(),
  channels: z.record(z.string(), channelEntrySchema).optional(),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginTemplateEntry = z.infer<typeof templateEntrySchema>;
export type PluginChannelEntry = z.infer<typeof channelEntrySchema>;
export type PluginConfigField = z.infer<typeof configFieldSchema>;

export function validatePluginManifest(
  data: unknown
): { success: true; manifest: PluginManifest } | { success: false; error: string } {
  const result = pluginManifestSchema.safeParse(data);
  if (!result.success) {
    const first = result.error.flatten().fieldErrors;
    const msg = Object.entries(first)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("; ");
    return { success: false, error: msg || "Invalid manifest" };
  }
  const manifest = result.data;
  if (manifest.provides?.templates?.length) {
    for (const id of manifest.provides.templates) {
      if (!manifest.templates?.[id]) {
        return {
          success: false,
          error: `provides.templates references missing template: ${id}`,
        };
      }
    }
  }
  if (manifest.provides?.channels?.length) {
    for (const id of manifest.provides.channels) {
      if (!manifest.channels?.[id]) {
        return {
          success: false,
          error: `provides.channels references missing channel: ${id}`,
        };
      }
    }
  }
  return { success: true, manifest };
}
