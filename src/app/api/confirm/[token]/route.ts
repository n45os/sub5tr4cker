import { NextRequest, NextResponse } from "next/server";
import { verifyConfirmationToken } from "@/lib/tokens";
import { dbConnect } from "@/lib/db/mongoose";
import { BillingPeriod, Group, User } from "@/models";
import { sendAdminConfirmationRequest } from "@/lib/telegram/send";
import { adminVerificationKeyboard } from "@/lib/telegram/keyboards";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = verifyConfirmationToken(token);

  if (!payload) {
    return NextResponse.redirect(
      new URL("/confirmed?error=invalid", process.env.APP_URL || "http://localhost:3000")
    );
  }

  await dbConnect();

  const period = await BillingPeriod.findById(payload.periodId);
  if (!period) {
    return NextResponse.redirect(
      new URL("/confirmed?error=not_found", process.env.APP_URL || "http://localhost:3000")
    );
  }

  const payment = period.payments.find(
    (p: { memberId: { toString: () => string } }) => p.memberId.toString() === payload.memberId
  );
  if (!payment) {
    return NextResponse.redirect(
      new URL("/confirmed?error=not_found", process.env.APP_URL || "http://localhost:3000")
    );
  }

  // already confirmed
  if (payment.status !== "pending" && payment.status !== "overdue") {
    return NextResponse.redirect(
      new URL(
        `/confirmed?group=${payload.groupId}&period=${period.periodLabel}&already=true`,
        process.env.APP_URL || "http://localhost:3000"
      )
    );
  }

  // mark as member confirmed
  payment.status = "member_confirmed";
  payment.memberConfirmedAt = new Date();
  await period.save();

  // notify admin via Telegram if possible
  const group = await Group.findById(payload.groupId);
  if (group) {
    const admin = await User.findById(group.admin);
    if (admin?.telegram?.chatId) {
      const keyboard = adminVerificationKeyboard(
        payload.periodId,
        payload.memberId
      );
      await sendAdminConfirmationRequest(
        admin.telegram.chatId,
        payment.memberNickname,
        group.name,
        period.periodLabel,
        payment.amount,
        period.currency,
        keyboard
      );
    }
  }

  return NextResponse.redirect(
    new URL(
      `/confirmed?group=${group?.name || ""}&period=${period.periodLabel}&success=true`,
      process.env.APP_URL || "http://localhost:3000"
    )
  );
}
