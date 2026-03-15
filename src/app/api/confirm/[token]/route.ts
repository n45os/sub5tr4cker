import { NextRequest, NextResponse } from "next/server";
import {
  verifyConfirmationToken,
  createMemberPortalToken,
  getMemberPortalUrl,
} from "@/lib/tokens";
import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group } from "@/models";
import { enqueueTask } from "@/lib/tasks/queue";
import { runNotificationTasks } from "@/jobs/run-notification-tasks";
import { getSetting } from "@/lib/settings/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = await verifyConfirmationToken(token);
  const appUrl =
    (await getSetting("general.appUrl")) || new URL(_request.url).origin;

  if (!payload) {
    return NextResponse.redirect(
      new URL("/confirmed?error=invalid", appUrl)
    );
  }

  const memberPortalToken = await createMemberPortalToken(
    payload.memberId,
    payload.groupId
  );
  const memberPortalUrl = await getMemberPortalUrl(memberPortalToken);

  await dbConnect();

  const period = await BillingPeriod.findById(payload.periodId);
  if (!period) {
    return NextResponse.redirect(
      new URL(memberPortalUrl, appUrl)
    );
  }

  const payment = period.payments.find(
    (p: { memberId: { toString: () => string } }) => p.memberId.toString() === payload.memberId
  );
  if (!payment) {
    return NextResponse.redirect(
      new URL(memberPortalUrl, appUrl)
    );
  }

  // already confirmed
  if (payment.status !== "pending" && payment.status !== "overdue") {
    return NextResponse.redirect(
      new URL(`${memberPortalUrl}?confirmed=true&already=true`, appUrl)
    );
  }

  // mark as member confirmed
  payment.status = "member_confirmed";
  payment.memberConfirmedAt = new Date();
  await period.save();

  // enqueue admin verification nudge (telegram by default when linked; email if tg unavailable)
  const group = await Group.findById(payload.groupId);
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
