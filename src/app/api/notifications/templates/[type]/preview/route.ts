/**
 * @deprecated not used by the app UI — previews use `@/lib/plugins/templates` directly.
 * Kept for potential external clients; may be removed later.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNotificationTemplatePreview } from "@/lib/plugins/templates";

export async function GET(
  request: NextRequest,
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
  const theme = request.nextUrl.searchParams.get("theme");
  const preview = getNotificationTemplatePreview(type, { theme });

  if (!preview) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Template not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: preview });
}
