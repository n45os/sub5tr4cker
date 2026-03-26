import { NextRequest, NextResponse } from "next/server";
import {
  verifyConfirmationToken,
  createMemberPortalToken,
  getMemberPortalUrl,
} from "@/lib/tokens";
import { enqueueTask } from "@/lib/tasks/queue";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";
import { getSetting } from "@/lib/settings/service";
import { db, type StorageMemberPayment } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = await verifyConfirmationToken(token);
  const appUrl =
    (await getSetting("general.appUrl")) || new URL(_request.url).origin;

  if (!payload) {
    return NextResponse.redirect(new URL("/confirmed?error=invalid", appUrl));
  }

  const memberPortalToken = await createMemberPortalToken(
    payload.memberId,
    payload.groupId
  );
  const memberPortalUrl = await getMemberPortalUrl(memberPortalToken);

  const store = await db();
  const period = await store.getBillingPeriod(payload.periodId, payload.groupId);
  if (!period) {
    return NextResponse.redirect(new URL(memberPortalUrl, appUrl));
  }

  const payIdx = period.payments.findIndex(
    (p: StorageMemberPayment) => p.memberId === payload.memberId
  );
  if (payIdx === -1) {
    return NextResponse.redirect(new URL(memberPortalUrl, appUrl));
  }

  const payment = period.payments[payIdx]!;

  if (payment.status !== "pending" && payment.status !== "overdue") {
    return NextResponse.redirect(
      new URL(`${memberPortalUrl}?confirmed=true&already=true`, appUrl)
    );
  }

  const updatedPayment: StorageMemberPayment = {
    ...payment,
    status: "member_confirmed",
    memberConfirmedAt: new Date(),
  };
  const payments = period.payments.map((p, i) => (i === payIdx ? updatedPayment : p));

  await store.updateBillingPeriod(payload.periodId, { payments });

  const group = await store.getGroup(payload.groupId);
  if (group) {
    await enqueueTask({
      type: "admin_confirmation_request",
      runAt: new Date(),
      payload: {
        groupId: payload.groupId,
        billingPeriodId: payload.periodId,
      },
    });
    await runNotificationTasks({ limit: 5 });
  }

  return NextResponse.redirect(new URL(`${memberPortalUrl}?confirmed=true`, appUrl));
}
