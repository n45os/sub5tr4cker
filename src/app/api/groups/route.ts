import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { generateUniqueInviteCode } from "@/lib/invite-code";
import { Group, BillingPeriod } from "@/models";
import { getNextPeriodStart } from "@/lib/billing/calculator";
import type { IGroup, IGroupMember } from "@/models";

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  service: z.object({
    name: z.string().min(1).max(100),
    icon: z.string().max(20).optional().nullable(),
    url: z.string().url().max(500).optional().nullable(),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  }),
  billing: z.object({
    mode: z.enum(["equal_split", "fixed_amount", "variable"]),
    currentPrice: z.number().positive(),
    currency: z.string().length(3).default("EUR"),
    cycleDay: z.number().int().min(1).max(28).default(1),
    cycleType: z.enum(["monthly", "yearly"]).default("monthly"),
    adminIncludedInSplit: z.boolean().default(true),
    gracePeriodDays: z.number().int().min(0).max(31).default(3),
    fixedMemberAmount: z.number().positive().optional().nullable(),
  }),
  payment: z.object({
    platform: z.enum(["revolut", "paypal", "bank_transfer", "stripe", "custom"]),
    link: z.string().url().max(500).optional().nullable(),
    instructions: z.string().max(2000).optional().nullable(),
  }),
  members: z
    .array(
      z.object({
        email: z.string().email(),
        nickname: z.string().min(1).max(100),
        customAmount: z.number().positive().optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  await dbConnect();

  const userId = session.user.id;
  const userEmail = (session.user.email as string) || "";

  // groups where user is admin or member (by user id or email)
  const groups = await Group.find({
    isActive: true,
    $or: [
      { admin: userId },
      { "members.user": userId },
      { "members.email": userEmail, "members.isActive": true },
    ],
  })
    .lean<IGroup[]>()
    .exec();

  const list = await Promise.all(
    groups.map(async (g) => {
      const role =
        g.admin.toString() === userId ? "admin" : "member";
      const memberCount = g.members.filter(
        (m: IGroupMember) => m.isActive && !m.leftAt
      ).length;
      const nextBillingDate = getNextPeriodStart(g.billing.cycleDay)
        .toISOString()
        .slice(0, 10);

      const latestPeriod = await BillingPeriod.findOne({ group: g._id })
        .sort({ periodStart: -1 })
        .lean()
        .exec();
      let unpaidCount = 0;
      if (latestPeriod?.payments) {
        unpaidCount = latestPeriod.payments.filter((p: { status: string }) =>
          ["pending", "member_confirmed", "overdue"].includes(p.status)
        ).length;
      }

      return {
        _id: g._id.toString(),
        name: g.name,
        service: g.service,
        role,
        memberCount,
        billing: {
          currentPrice: g.billing.currentPrice,
          currency: g.billing.currency,
          mode: g.billing.mode,
        },
        nextBillingDate,
        unpaidCount,
      };
    })
  );

  return NextResponse.json({ data: { groups: list } });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const parsed = createGroupSchema.safeParse(await request.json());
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

  const body = parsed.data;
  await dbConnect();

  const members = body.members.map((m) => ({
    email: m.email,
    nickname: m.nickname,
    customAmount: m.customAmount ?? null,
    role: "member" as const,
    isActive: true,
    leftAt: null,
  }));

  // assign a unique invite code on create to avoid duplicate null in unique index
  const inviteCode = await generateUniqueInviteCode(async (c) => {
    const existing = await Group.findOne({ inviteCode: c }).lean();
    return !!existing;
  });

  const group = await Group.create({
    name: body.name,
    admin: session.user.id,
    service: {
      name: body.service.name,
      icon: body.service.icon ?? null,
      url: body.service.url ?? null,
      accentColor: body.service.accentColor ?? null,
    },
    billing: {
      mode: body.billing.mode,
      currentPrice: body.billing.currentPrice,
      currency: body.billing.currency,
      cycleDay: body.billing.cycleDay,
      cycleType: body.billing.cycleType,
      adminIncludedInSplit: body.billing.adminIncludedInSplit,
      fixedMemberAmount: body.billing.fixedMemberAmount ?? null,
      gracePeriodDays: body.billing.gracePeriodDays,
    },
    payment: {
      platform: body.payment.platform,
      link: body.payment.link ?? null,
      instructions: body.payment.instructions ?? null,
      stripeAccountId: null,
    },
    notifications: {
      remindersEnabled: true,
      followUpsEnabled: true,
      priceChangeEnabled: true,
    },
    members,
    isActive: true,
    inviteCode,
    inviteLinkEnabled: false,
  });

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "group_created",
    groupId: group._id.toString(),
    metadata: { name: group.name },
  });

  return NextResponse.json({
    data: {
      _id: group._id.toString(),
      name: group.name,
      service: group.service,
      billing: group.billing,
      payment: group.payment,
      notifications: group.notifications,
      members: group.members.map((m: IGroupMember) => ({
        _id: m._id.toString(),
        email: m.email,
        nickname: m.nickname,
        role: m.role,
        isActive: m.isActive,
      })),
    },
  });
}
