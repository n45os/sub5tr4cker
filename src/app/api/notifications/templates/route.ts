import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isInstanceAdmin } from "@/lib/authorization";
import { getNotificationTemplates } from "@/lib/plugins/templates";

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
      { error: { code: "FORBIDDEN", message: "Only admins can view notification templates" } },
      { status: 403 }
    );
  }

  return NextResponse.json({
    data: {
      templates: getNotificationTemplates(),
    },
  });
}
