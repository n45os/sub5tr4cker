import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/storage";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  const parsed = registerSchema.safeParse(await request.json());
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

  const { email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const store = await db();

  const existing = await store.getUserByEmail(normalizedEmail);
  if (existing) {
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

  const usersCount = await store.countUsers();
  const hashedPassword = await hash(password, 12);
  await store.createUser({
    name: name.trim(),
    email: normalizedEmail,
    hashedPassword,
    role: usersCount === 0 ? "admin" : "user",
    notificationPreferences: {
      email: true,
      telegram: false,
      reminderFrequency: "every_3_days",
    },
  });

  return NextResponse.json({
    data: { message: "Account created. You can sign in now." },
  });
}
