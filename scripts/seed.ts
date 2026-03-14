/**
 * Seed script: creates a demo group with 5 months of billing history,
 * payments, and notifications. Idempotent (removes existing *@demo.local data first).
 *
 * Run: pnpm seed
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// load .env.local (and .env) so MONGODB_URI etc. are set when running via tsx
const root = resolve(__dirname, "..");
for (const file of [".env.local", ".env"]) {
  const path = resolve(root, file);
  if (existsSync(path)) {
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
      }
    }
    break;
  }
}

import { hash } from "bcryptjs";
import { dbConnect } from "@/lib/db/mongoose";
import {
  User,
  Group,
  BillingPeriod,
  Notification,
} from "@/models";
import { formatPeriodLabel, getPeriodDates } from "@/lib/billing/calculator";
import type { Types } from "mongoose";

const DEMO_EMAIL_SUFFIX = "@demo.local";
const ADMIN_EMAIL = "admin@demo.local";
const ADMIN_PASSWORD = "demo1234";
const MEMBER_EMAILS = ["alice@demo.local", "bob@demo.local", "charlie@demo.local"];
const MEMBER_NAMES = ["Alice", "Bob", "Charlie"];

async function main() {
  console.log("Connecting to database...");
  await dbConnect();

  // resolve demo users and groups for cleanup
  const demoUsers = await User.find({
    email: { $regex: new RegExp(`${DEMO_EMAIL_SUFFIX.replace(".", "\\.")}$`) },
  }).lean();
  const demoUserIds = demoUsers.map((u) => u._id);
  const demoGroups = await Group.find({ admin: { $in: demoUserIds } }).lean();
  const demoGroupIds = demoGroups.map((g) => g._id);

  if (demoUserIds.length > 0) {
    console.log("Removing existing demo data...");
    await Notification.deleteMany({
      $or: [
        { group: { $in: demoGroupIds } },
        { recipientEmail: { $regex: new RegExp(`${DEMO_EMAIL_SUFFIX.replace(".", "\\.")}$`) } },
      ],
    });
    await BillingPeriod.deleteMany({ group: { $in: demoGroupIds } });
    await Group.deleteMany({ _id: { $in: demoGroupIds } });
    await User.deleteMany({ email: { $regex: new RegExp(`${DEMO_EMAIL_SUFFIX.replace(".", "\\.")}$`) } });
  }

  console.log("Creating demo users...");
  const hashedPassword = await hash(ADMIN_PASSWORD, 12);
  // use distinct fake telegram.chatId so unique sparse index doesn't conflict on null
  const adminUser = await User.create({
    name: "Demo Admin",
    email: ADMIN_EMAIL,
    hashedPassword,
    telegram: { chatId: -1, username: null, linkedAt: null },
    notificationPreferences: {
      email: true,
      telegram: false,
      reminderFrequency: "every_3_days",
    },
  });

  const memberUsers = await User.insertMany(
    MEMBER_EMAILS.map((email, i) => ({
      name: MEMBER_NAMES[i],
      email,
      telegram: { chatId: -(i + 2), username: null, linkedAt: null },
      notificationPreferences: {
        email: true,
        telegram: false,
        reminderFrequency: "every_3_days",
      },
    }))
  );

  console.log("Creating demo group...");
  const now = new Date();
  const cycleDay = 1;
  const members = memberUsers.map((u, i) => ({
    user: u._id,
    email: MEMBER_EMAILS[i],
    nickname: MEMBER_NAMES[i],
    role: "member" as const,
    joinedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
    leftAt: null,
    isActive: true,
    customAmount: null,
    unsubscribedFromEmail: false,
  }));

  const group = await Group.create({
    name: "YouTube Premium Family",
    description: "Family plan for testing",
    admin: adminUser._id,
    service: { name: "YouTube Premium", icon: null, url: null },
    billing: {
      mode: "equal_split",
      currentPrice: 22.99,
      currency: "EUR",
      cycleDay,
      cycleType: "monthly",
      adminIncludedInSplit: true,
      fixedMemberAmount: null,
      gracePeriodDays: 3,
    },
    payment: {
      platform: "revolut",
      link: null,
      instructions: null,
      stripeAccountId: null,
    },
    notifications: {
      remindersEnabled: true,
      followUpsEnabled: true,
      priceChangeEnabled: true,
    },
    members,
    announcements: { notifyOnPriceChange: true, extraText: null },
    telegramGroup: { chatId: null, linkedAt: null },
    isActive: true,
    inviteCode: "demo-seed-yt-family",
    inviteLinkEnabled: false,
    initializedAt: now,
  });

  // 5 months: from (current year, current month - 4) to (current year, current month)
  const periods: Array<{
    periodStart: Date;
    periodEnd: Date;
    periodLabel: string;
    paymentStatuses: Array<"confirmed" | "member_confirmed" | "pending">;
    reminderCount: number;
  }> = [];
  for (let i = -4; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, cycleDay);
    const { start, end } = getPeriodDates(d.getFullYear(), d.getMonth(), cycleDay);
    const periodLabel = formatPeriodLabel(start);
    // oldest 3: all confirmed; 4th: 2 confirmed, 1 member_confirmed; current: all pending
    let paymentStatuses: Array<"confirmed" | "member_confirmed" | "pending">;
    if (i <= -2) {
      paymentStatuses = ["confirmed", "confirmed", "confirmed"];
    } else if (i === -1) {
      paymentStatuses = ["confirmed", "confirmed", "member_confirmed"];
    } else {
      paymentStatuses = ["pending", "pending", "pending"];
    }
    const reminderCount = i <= -1 ? (i === -1 ? 2 : 3) : 0;
    periods.push({
      periodStart: start,
      periodEnd: end,
      periodLabel,
      paymentStatuses,
      reminderCount,
    });
  }

  const amountPerMember = Math.round((22.99 / 4) * 100) / 100; // 5.75
  const memberIds = (group.members as Array<{ _id: Types.ObjectId }>).map((m) => m._id);

  console.log("Creating billing periods and notifications...");
  const createdPeriods: Array<{ _id: Types.ObjectId; periodStart: Date; periodLabel: string; payments: Array<{ memberId: Types.ObjectId; memberNickname: string; memberEmail: string; status: string; memberConfirmedAt: Date | null; adminConfirmedAt: Date | null }> }> = [];

  for (let idx = 0; idx < periods.length; idx++) {
    const p = periods[idx];
    const periodStart = p.periodStart;
    const payments = memberIds.map((memberId, i) => {
      const status = p.paymentStatuses[i];
      const baseDate = new Date(periodStart);
      baseDate.setDate(baseDate.getDate() + 5);
      const memberConfirmedAt = status !== "pending" ? new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000) : null;
      const adminConfirmedAt =
        status === "confirmed"
          ? new Date(baseDate.getTime() + (i + 2) * 24 * 60 * 60 * 1000)
          : null;
      return {
        memberId,
        memberEmail: MEMBER_EMAILS[i],
        memberNickname: MEMBER_NAMES[i],
        amount: amountPerMember,
        status,
        memberConfirmedAt,
        adminConfirmedAt,
        confirmationToken: `seed-${idx}-${i}`,
        notes: null,
      };
    });

    const reminders: Array<{ sentAt: Date; channel: "email"; recipientCount: number; type: "initial" | "follow_up" }> = [];
    if (p.reminderCount > 0) {
      const graceEnd = new Date(periodStart);
      graceEnd.setDate(graceEnd.getDate() + 3);
      reminders.push({
        sentAt: new Date(graceEnd.getTime() + 24 * 60 * 60 * 1000),
        channel: "email",
        recipientCount: 3,
        type: "initial",
      });
      for (let r = 1; r < p.reminderCount; r++) {
        reminders.push({
          sentAt: new Date(graceEnd.getTime() + (r + 1) * 3 * 24 * 60 * 60 * 1000),
          channel: "email",
          recipientCount: 3,
          type: "follow_up",
        });
      }
    }

    const isFullyPaid = p.paymentStatuses.every((s) => s === "confirmed");
    const period = await BillingPeriod.create({
      group: group._id,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      periodLabel: p.periodLabel,
      totalPrice: 22.99,
      currency: "EUR",
      payments,
      reminders,
      isFullyPaid,
    });

    createdPeriods.push({
      _id: period._id as Types.ObjectId,
      periodStart: p.periodStart,
      periodLabel: p.periodLabel,
      payments: period.payments as Array<{
        memberId: Types.ObjectId;
        memberNickname: string;
        memberEmail: string;
        status: string;
        memberConfirmedAt: Date | null;
        adminConfirmedAt: Date | null;
      }>,
    });

    // seed notifications for past periods: reminders and follow-ups
    const unpaidCount = payments.filter((pay) => pay.status !== "confirmed").length;
    if (idx < periods.length - 1 && unpaidCount > 0) {
      const reminderDates = reminders.map((r) => r.sentAt);
      for (const reminderDate of reminderDates) {
        for (let i = 0; i < 3; i++) {
          await Notification.create({
            recipient: memberUsers[i]._id,
            recipientEmail: MEMBER_EMAILS[i],
            group: group._id,
            billingPeriod: period._id,
            type: reminderDate === reminderDates[0] ? "payment_reminder" : "follow_up",
            channel: "email",
            status: "sent",
            subject: `Pay your YouTube Premium share — ${p.periodLabel}`,
            preview: `Reminder for ${MEMBER_NAMES[i]}: ${amountPerMember} EUR`,
            deliveredAt: reminderDate,
            createdAt: reminderDate,
          });
        }
      }
    }
    if (p.paymentStatuses.some((s) => s === "member_confirmed")) {
      const nudgeDate = new Date(periodStart);
      nudgeDate.setDate(nudgeDate.getDate() + 10);
      await Notification.create({
        recipient: adminUser._id,
        recipientEmail: ADMIN_EMAIL,
        group: group._id,
        billingPeriod: period._id,
        type: "admin_confirmation_request",
        channel: "email",
        status: "sent",
        subject: `Verify payments for YouTube Premium Family — ${p.periodLabel}`,
        preview: "1 member(s) reported payment, awaiting your verification",
        deliveredAt: nudgeDate,
        createdAt: nudgeDate,
      });
    }
    // payment_confirmed for confirmed payments
    for (let i = 0; i < payments.length; i++) {
      if (payments[i].status === "confirmed" && payments[i].adminConfirmedAt) {
        await Notification.create({
          recipient: memberUsers[i]._id,
          recipientEmail: MEMBER_EMAILS[i],
          group: group._id,
          billingPeriod: period._id,
          type: "payment_confirmed",
          channel: "email",
          status: "sent",
          subject: `Payment confirmed — ${p.periodLabel}`,
          preview: `Your payment of ${amountPerMember} EUR has been confirmed.`,
          deliveredAt: payments[i].adminConfirmedAt,
          createdAt: payments[i].adminConfirmedAt,
        });
      }
    }
  }

  const notificationCount = await Notification.countDocuments({
    group: group._id,
  });

  console.log("\n--- Seed complete ---");
  console.log("Admin login (credentials):");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`Group: ${group.name} (${group._id})`);
  console.log(`Billing periods: ${createdPeriods.length}`);
  console.log(`Notifications: ${notificationCount}`);
  console.log("------------------------\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
