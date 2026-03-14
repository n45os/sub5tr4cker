import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { User } from "@/models";

const updateProfileSchema = z.object({
  email: z.string().email("Enter a valid email address").transform((v) => v.trim().toLowerCase()),
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

  const { email } = parsed.data;
  await dbConnect();

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

  const user = await User.findByIdAndUpdate(
    session.user.id,
    { $set: { email, emailVerified: null } },
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
    },
  });
}
