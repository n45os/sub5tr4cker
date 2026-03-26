import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, type StorageUser } from "@/lib/storage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const store = await db();
  const user = await store.getUser(session.user.id);

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
  const store = await db();

  const existing = await store.getUser(session.user.id);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  if (email !== undefined) {
    const conflict = await store.getUserByEmail(email);
    if (conflict && conflict.id !== session.user.id) {
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

  if (email === undefined && notificationPreferences === undefined) {
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

  const patch: Partial<Omit<StorageUser, "id" | "createdAt">> = {};
  if (email !== undefined) {
    patch.email = email;
    patch.emailVerified = null;
  }
  if (notificationPreferences !== undefined) {
    patch.notificationPreferences = {
      ...existing.notificationPreferences,
      ...notificationPreferences,
    };
  }

  const user = await store.updateUser(session.user.id, patch);

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
