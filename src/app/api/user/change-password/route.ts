import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/storage";

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const parsed = changePasswordSchema.safeParse(await request.json());
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

  const { currentPassword, newPassword } = parsed.data;

  const store = await db();
  const user = await store.getUser(session.user.id);

  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  if (user.hashedPassword) {
    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PASSWORD",
            message: "Current password is required",
          },
        },
        { status: 400 }
      );
    }
    const match = await compare(currentPassword, user.hashedPassword);
    if (!match) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PASSWORD",
            message: "Current password is incorrect",
          },
        },
        { status: 400 }
      );
    }
  }

  const hashedPassword = await hash(newPassword, 12);
  await store.updateUser(session.user.id, { hashedPassword });

  return NextResponse.json({
    data: { message: "Password updated." },
  });
}
