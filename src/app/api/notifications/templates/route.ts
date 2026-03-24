/**
 * @deprecated not used by the app UI — template list comes from `@/lib/plugins/templates`
 * in client code. Kept for API parity; may be removed later.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNotificationTemplates } from "@/lib/plugins/templates";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    data: {
      templates: getNotificationTemplates(),
    },
  });
}
