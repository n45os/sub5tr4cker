import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
  recalculateEqualSplitPeriodsForGroup,
} from "@/lib/billing/backfill";
import { calculateShares } from "@/lib/billing/calculator";
import { dbConnect } from "@/lib/db/mongoose";
import { Group, BillingPeriod, PriceHistory } from "@/models";
import type { IGroupMember, IMemberPayment } from "@/models";
import {
  filterGroupForMember,
  getGroupAccess,
  getMemberEntry,
} from "@/lib/authorization";
import { sendPriceChangeAnnouncements } from "@/lib/notifications/service";
import { createConfirmationToken } from "@/lib/tokens";

const updateGroupSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    service: z
      .object({
        name: z.string().min(1).max(100).optional(),
        icon: z.string().max(20).optional().nullable(),
        url: z.string().url().max(500).optional().nullable(),
        accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
      })
      .optional(),
    billing: z
      .object({
        mode: z.enum(["equal_split", "fixed_amount", "variable"]).optional(),
        currentPrice: z.number().positive().optional(),
        currency: z.string().length(3).optional(),
        cycleDay: z.number().int().min(1).max(28).optional(),
        cycleType: z.enum(["monthly", "yearly"]).optional(),
        adminIncludedInSplit: z.boolean().optional(),
        gracePeriodDays: z.number().int().min(0).max(31).optional(),
        fixedMemberAmount: z.number().positive().optional().nullable(),
      })
      .optional(),
    payment: z
      .object({
        platform: z
          .enum(["revolut", "paypal", "bank_transfer", "stripe", "custom"])
          .optional(),
        link: z.string().url().max(500).optional().nullable(),
        instructions: z.string().max(2000).optional().nullable(),
      })
      .optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
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

  await dbConnect();
  const group = await Group.findById(groupId).populate({
    path: "members.user",
    model: "User",
    select: "telegram notificationPreferences",
  });
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  const access = getGroupAccess(
    group,
    session.user.id,
    (session.user.email as string) || ""
  );
  if (!access) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not authorized to view this group" } },
      { status: 403 }
    );
  }

  const memberEntry = getMemberEntry(
    group,
    session.user.id,
    (session.user.email as string) || ""
  );

  // group admins may not be in the members array (they're the owner)
  if (!memberEntry && access !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not authorized to view this group" } },
      { status: 403 }
    );
  }

  const payload = filterGroupForMember(group, memberEntry, access);

  return NextResponse.json({ data: payload });
}

export async function PATCH(
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

  const parsed = updateGroupSchema.safeParse(await request.json());
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

  await dbConnect();
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can update the group" } },
      { status: 403 }
    );
  }

  const body = parsed.data;
  const previousPrice = group.billing.currentPrice;
  const previousAdminIncludedInSplit = group.billing.adminIncludedInSplit;

  if (body.name !== undefined) group.name = body.name;
  if (body.description !== undefined) group.description = body.description;
  if (body.service) {
    if (body.service.name !== undefined) group.service.name = body.service.name;
    if ("icon" in body.service) group.service.icon = body.service.icon ?? null;
    if ("url" in body.service) group.service.url = body.service.url ?? null;
    if ("accentColor" in body.service) group.service.accentColor = body.service.accentColor ?? null;
  }
  if (body.billing) {
    if (body.billing.mode !== undefined) group.billing.mode = body.billing.mode;
    if (body.billing.currentPrice !== undefined)
      group.billing.currentPrice = body.billing.currentPrice;
    if (body.billing.currency !== undefined)
      group.billing.currency = body.billing.currency;
    if (body.billing.cycleDay !== undefined)
      group.billing.cycleDay = body.billing.cycleDay;
    if (body.billing.cycleType !== undefined)
      group.billing.cycleType = body.billing.cycleType;
    if (body.billing.adminIncludedInSplit !== undefined)
      group.billing.adminIncludedInSplit = body.billing.adminIncludedInSplit;
    if (body.billing.gracePeriodDays !== undefined)
      group.billing.gracePeriodDays = body.billing.gracePeriodDays;
    if ("fixedMemberAmount" in (body.billing || {}))
      group.billing.fixedMemberAmount = body.billing.fixedMemberAmount ?? null;
  }
  if (body.payment) {
    if (body.payment.platform !== undefined)
      group.payment.platform = body.payment.platform;
    if ("link" in body.payment) group.payment.link = body.payment.link ?? null;
    if ("instructions" in body.payment)
      group.payment.instructions = body.payment.instructions ?? null;
  }

  await group.save();

  const adminIncludedInSplitChanged =
    body.billing?.adminIncludedInSplit !== undefined &&
    previousAdminIncludedInSplit !== group.billing.adminIncludedInSplit;

  if (adminIncludedInSplitChanged) {
    try {
      await recalculateEqualSplitPeriodsForGroup(group);
    } catch (error) {
      console.error(
        "recalculate billing periods after adminIncludedInSplit change failed:",
        error,
      );
    }
  }

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "group_edited",
    groupId,
    metadata: { name: group.name },
  });

  const priceChanged =
    body.billing?.currentPrice !== undefined &&
    previousPrice !== group.billing.currentPrice;

  // record price history
  if (priceChanged) {
    try {
      await PriceHistory.create({
        group: groupId,
        price: group.billing.currentPrice,
        previousPrice,
        currency: group.billing.currency,
        effectiveFrom: new Date(),
        createdBy: session.user.id,
      });
    } catch (error) {
      console.error("failed to record price history:", error);
    }
  }

  if (
    priceChanged &&
    (group.notifications?.priceChangeEnabled ??
      group.announcements?.notifyOnPriceChange)
  ) {
    try {
      await sendPriceChangeAnnouncements(group, {
        previousPrice,
        newPrice: group.billing.currentPrice,
        currency: group.billing.currency,
        serviceName: group.service.name,
      });
    } catch (error) {
      console.error("price-change announcements failed:", error);
    }
  }

  // adjust future pre-paid periods when price increases
  if (priceChanged) {
    try {
      const futurePeriods = await BillingPeriod.find({
        group: groupId,
        periodStart: { $gt: new Date() },
      });

      for (const period of futurePeriods) {
        const newShares = calculateShares(group, group.billing.currentPrice, period.periodStart);

        for (const payment of period.payments) {
          const typedPayment = payment as IMemberPayment;
          const newShare = newShares.find(
            (s) => s.memberId === typedPayment.memberId.toString(),
          );
          if (!newShare) continue;

          const currentEffective = typedPayment.adjustedAmount ?? typedPayment.amount;
          if (newShare.amount === currentEffective) continue;

          if (typedPayment.status === "confirmed") {
            // pre-paid: add a supplementary payment entry for the diff
            const diff = newShare.amount - currentEffective;
            if (diff > 0) {
              const token = await createConfirmationToken(
                typedPayment.memberId.toString(),
                period._id.toString(),
                groupId,
              );
              period.payments.push({
                memberId: typedPayment.memberId,
                memberEmail: typedPayment.memberEmail,
                memberNickname: typedPayment.memberNickname,
                amount: diff,
                adjustmentReason: `price updated from ${previousPrice} to ${group.billing.currentPrice} ${group.billing.currency}`,
                status: "pending",
                confirmationToken: token,
              } as never);
              period.isFullyPaid = false;
            }
          } else {
            // not yet paid: update the amount directly
            typedPayment.adjustedAmount = newShare.amount;
            typedPayment.adjustmentReason = `price updated from ${previousPrice} to ${group.billing.currentPrice} ${group.billing.currency}`;
          }
        }

        await period.save();
      }
    } catch (error) {
      console.error("future period price adjustment failed:", error);
    }
  }

  return NextResponse.json({
    data: {
      _id: group._id.toString(),
      name: group.name,
      description: group.description,
      service: group.service,
      billing: group.billing,
      payment: group.payment,
      notifications: group.notifications,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
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

  await dbConnect();
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Group not found" } },
      { status: 404 }
    );
  }

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the admin can delete the group" } },
      { status: 403 }
    );
  }

  group.isActive = false;
  await group.save();

  return NextResponse.json({ data: { success: true } });
}
