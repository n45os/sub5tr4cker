import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { applyAdminPaymentDecision } from "@/lib/billing/admin-confirm";
import { isStorageId } from "@/lib/storage";

const confirmSchema = z.object({
  memberId: z.string(),
  action: z.enum(["confirm", "reject", "waive"]),
  notes: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string; periodId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId, periodId } = await context.params;
  if (!isStorageId(groupId) || !isStorageId(periodId)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid group or period id" } },
      { status: 400 }
    );
  }

  const parsed = confirmSchema.safeParse(await request.json());
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

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";

  const result = await applyAdminPaymentDecision({
    groupId,
    periodId,
    memberId: parsed.data.memberId,
    action: parsed.data.action,
    actor: { id: session.user.id, name: actorName },
    notes: parsed.data.notes,
  });

  if (!result.ok) {
    if (result.code === "GROUP_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Group not found" } },
        { status: 404 }
      );
    }
    if (result.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the admin can confirm payments" } },
        { status: 403 }
      );
    }
    if (result.code === "PERIOD_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Billing period not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Payment entry not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      memberId: result.payment.memberId,
      status: result.payment.status,
      adminConfirmedAt: result.payment.adminConfirmedAt?.toISOString() ?? null,
    },
  });
}
