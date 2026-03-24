/**
 * @deprecated not used by the dashboard — previews use `@/lib/email/templates` and
 * `@/lib/plugins/templates` directly. Kept for potential external clients; may be removed later.
 */
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";
import { buildPaymentReminderEmailHtml } from "@/lib/email/templates/payment-reminder";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  if (!mongoose.isValidObjectId(groupId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
      { status: 400 }
    );
  }

  const type = request.nextUrl.searchParams.get("type") ?? "payment_reminder";
  const themeOverride = request.nextUrl.searchParams.get("theme");
  if (type !== "payment_reminder") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Only payment_reminder preview is supported for now",
        },
      },
      { status: 400 }
    );
  }

  await dbConnect();
  const group = await Group.findById(groupId).lean();
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the group admin can access this preview",
        },
      },
      { status: 403 }
    );
  }

  const emailHtml = buildPaymentReminderEmailHtml({
    memberName: "Alex",
    groupName: group.name,
    periodLabel: "Preview period",
    amount: group.billing.currentPrice,
    currency: group.billing.currency,
    paymentPlatform: group.payment.platform,
    paymentLink: group.payment.link ?? null,
    paymentInstructions: group.payment.instructions ?? null,
    confirmUrl: "https://example.com/member/demo-token?pay=periodId&open=confirm",
    ownerName: "Group admin",
    extraText:
      group.announcements?.extraText ??
      "Preview mode using current group configuration.",
    accentColor: group.service?.accentColor ?? null,
    theme: themeOverride ?? group.service?.emailTheme ?? "clean",
  });

  return NextResponse.json({
    data: {
      type,
      subject: `Pay your share — Preview period`,
      emailHtml,
    },
  });
}
