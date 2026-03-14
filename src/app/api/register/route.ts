import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { dbConnect } from "@/lib/db/mongoose";
import { User } from "@/models";

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

  await dbConnect();

  const existing = await User.findOne({ email: normalizedEmail });
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

  const hashedPassword = await hash(password, 12);
  await User.create({
    name: name.trim(),
    email: normalizedEmail,
    hashedPassword,
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
