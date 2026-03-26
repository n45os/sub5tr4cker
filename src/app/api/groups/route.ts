import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { generateUniqueInviteCode } from "@/lib/invite-code";
import {
  aggregateOutstandingByGroupFromPeriods,
  getOpenOutstandingPeriods,
} from "@/lib/dashboard/billing-snapshot";
import { getNextPeriodStart } from "@/lib/billing/calculator";
import { createPeriodIfDue } from "@/lib/billing/periods";
import { db } from "@/lib/storage";

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  service: z.object({
    name: z.string().min(1).max(100),
    icon: z.string().max(20).optional().nullable(),
    url: z.string().url().max(500).optional().nullable(),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    emailTheme: z
      .enum(["clean", "minimal", "bold", "rounded", "corporate"])
      .optional(),
  }),
  billing: z.object({
    mode: z.enum(["equal_split", "fixed_amount", "variable"]),
    currentPrice: z.number().positive(),
    currency: z.string().length(3).default("EUR"),
    cycleDay: z.number().int().min(1).max(28).default(1),
    cycleType: z.enum(["monthly", "yearly"]).default("monthly"),
    adminIncludedInSplit: z.boolean().default(true),
    gracePeriodDays: z.number().int().min(0).max(31).default(3),
    paymentInAdvanceDays: z.number().int().min(0).max(365).default(0),
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

  const store = await db();

  const userId = session.user.id;
  const userEmail = (session.user.email as string) || "";

  const groups = await store.listGroupsForUser(userId, userEmail);

  const now = new Date();
  const groupIds = groups.map((g) => g.id);
  const periods =
    groupIds.length === 0
      ? []
      : await getOpenOutstandingPeriods(store, groupIds, now);

  const outstandingByGroup = aggregateOutstandingByGroupFromPeriods(periods);

  const list = groups.map((g) => {
    const role = g.adminId === userId ? "admin" : "member";
    const memberCount = g.members.filter(
      (m) => m.isActive && !m.leftAt
    ).length;
    const nextBillingDate = getNextPeriodStart(g.billing.cycleDay)
      .toISOString()
      .slice(0, 10);

    const gid = g.id;
    const unpaidCount =
      outstandingByGroup.get(gid)?.outstandingPaymentCount ?? 0;

    return {
      _id: gid,
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
  });

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
  const store = await db();

  const members = body.members.map((m) => ({
    id: nanoid(),
    userId: null,
    email: m.email,
    nickname: m.nickname,
    customAmount: m.customAmount ?? null,
    role: "member" as const,
    joinedAt: new Date(),
    isActive: true,
    leftAt: null,
    acceptedAt: null,
    unsubscribedFromEmail: false,
    billingStartsAt: null,
  }));

  // assign a unique invite code on create to avoid duplicate null in unique index
  const inviteCode = await generateUniqueInviteCode(async (c) => {
    const existing = await store.findGroupByInviteCode(c);
    return existing != null;
  });

  const group = await store.createGroup({
    name: body.name,
    description: null,
    adminId: session.user.id,
    service: {
      name: body.service.name,
      icon: body.service.icon ?? null,
      url: body.service.url ?? null,
      accentColor: body.service.accentColor ?? null,
      emailTheme: body.service.emailTheme ?? "clean",
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
      paymentInAdvanceDays: body.billing.paymentInAdvanceDays,
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
      saveEmailParams: false,
    },
    members,
    announcements: {
      notifyOnPriceChange: true,
      extraText: null,
    },
    telegramGroup: {
      chatId: null,
      linkedAt: null,
    },
    isActive: true,
    inviteCode,
    inviteLinkEnabled: false,
    initializedAt: null,
  });

  const actorName =
    (session.user.name as string) ||
    (session.user.email as string) ||
    "Unknown";
  await logAudit({
    actorId: session.user.id,
    actorName,
    action: "group_created",
    groupId: group.id,
    metadata: { name: group.name },
  });

  // create first billing period immediately if the current cycle has started (so user sees it right away)
  try {
    await createPeriodIfDue(group, new Date());
  } catch (err) {
    // don't fail group creation if period creation fails (e.g. no members yet)
  }

  return NextResponse.json({
    data: {
      _id: group.id,
      name: group.name,
      description: group.description,
      service: group.service,
      billing: group.billing,
      payment: group.payment,
      notifications: group.notifications,
      members: group.members.map((m) => ({
        _id: m.id,
        email: m.email,
        nickname: m.nickname,
        role: m.role,
        isActive: m.isActive,
      })),
    },
  });
}
