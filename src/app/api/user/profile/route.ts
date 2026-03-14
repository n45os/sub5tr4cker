import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { User } from "@/models";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  await dbConnect();
  const user = await User.findById(session.user.id)
    .select("email name image telegram notificationPreferences")
    .lean();

  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      email: user.email,
      name: user.name,
      image: user.image,
      telegram: {
        chatId: user.telegram?.chatId ?? null,
        username: user.telegram?.username ?? null,
        linkedAt: user.telegram?.linkedAt ?? null,
      },
      notificationPreferences: {
        email: user.notificationPreferences?.email ?? true,
        telegram: user.notificationPreferences?.telegram ?? false,
        reminderFrequency:
          user.notificationPreferences?.reminderFrequency ?? "every_3_days",
      },
    },
  });
}

const updateProfileSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address")
    .transform((v) => v.trim().toLowerCase())
    .optional(),
  notificationPreferences: z
    .object({
      email: z.boolean().optional(),
      telegram: z.boolean().optional(),
      reminderFrequency: z.enum(["once", "daily", "every_3_days"]).optional(),
    })
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const parsed = updateProfileSchema.safeParse(await request.json());
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

  const { email, notificationPreferences } = parsed.data;
  await dbConnect();

  if (email !== undefined) {
    const existing = await User.findOne({ email }).lean();
    if (existing && existing._id.toString() !== session.user.id) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "An account with this email already exists",
          },
        },
        { status: 409 }
      );
    }
  }

  const update: Record<string, unknown> = {};
  if (email !== undefined) {
    update.email = email;
    update.emailVerified = null;
  }
  if (notificationPreferences !== undefined) {
    if (notificationPreferences.email !== undefined) {
      update["notificationPreferences.email"] = notificationPreferences.email;
    }
    if (notificationPreferences.telegram !== undefined) {
      update["notificationPreferences.telegram"] =
        notificationPreferences.telegram;
    }
    if (notificationPreferences.reminderFrequency !== undefined) {
      update["notificationPreferences.reminderFrequency"] =
        notificationPreferences.reminderFrequency;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Provide email or notificationPreferences to update",
        },
      },
      { status: 400 }
    );
  }

  const user = await User.findByIdAndUpdate(
    session.user.id,
    { $set: update },
    { new: true }
  ).lean();

  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      email: user.email,
      name: user.name,
      image: user.image,
      telegram: {
        chatId: user.telegram?.chatId ?? null,
        username: user.telegram?.username ?? null,
        linkedAt: user.telegram?.linkedAt ?? null,
      },
      notificationPreferences: {
        email: user.notificationPreferences?.email ?? true,
        telegram: user.notificationPreferences?.telegram ?? false,
        reminderFrequency:
          user.notificationPreferences?.reminderFrequency ?? "every_3_days",
      },
    },
  });
}
