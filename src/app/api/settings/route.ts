import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isInstanceAdmin } from "@/lib/authorization";
import { getAllSettings, setSetting } from "@/lib/settings/service";
import { getSettingsDefinition } from "@/lib/settings/definitions";

const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string().nullable(),
    })
  ),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }
  if (!isInstanceAdmin(session)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only admins can access settings" } },
      { status: 403 }
    );
  }

  const settings = await getAllSettings();

  return NextResponse.json({
    data: {
      settings,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }
  if (!isInstanceAdmin(session)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only admins can update settings" } },
      { status: 403 }
    );
  }

  const parsed = updateSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const pluginKeyRegex = /^plugin\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
  for (const setting of parsed.data.settings) {
    const isPluginKey = pluginKeyRegex.test(setting.key);
    if (!isPluginKey && !getSettingsDefinition(setting.key)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Unknown setting key: ${setting.key}`,
          },
        },
        { status: 400 }
      );
    }
  }

  for (const setting of parsed.data.settings) {
    await setSetting(setting.key, setting.value);
  }

  const settings = await getAllSettings();

  return NextResponse.json({
    data: {
      settings,
    },
  });
}
