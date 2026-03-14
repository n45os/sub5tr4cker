import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getNotificationTemplatePreview,
  type NotificationTemplateType,
} from "@/lib/email/templates";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { type } = await context.params;
  const preview = getNotificationTemplatePreview(type as NotificationTemplateType);

  if (!preview) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Template not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: preview });
}
