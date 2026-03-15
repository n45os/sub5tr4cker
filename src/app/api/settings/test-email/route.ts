import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email/client";
import { getSetting } from "@/lib/settings/service";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const appUrl = (await getSetting("general.appUrl")) || "http://localhost:3054";
  const result = await sendEmail({
    to: session.user.email,
    subject: "sub5tr4cker settings test email",
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <div style="border-radius: 18px; border: 1px solid #e4e4e7; padding: 24px;">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #71717a;">sub5tr4cker</p>
          <h1 style="margin: 0 0 12px; font-size: 24px;">Email settings look good</h1>
          <p style="margin: 0 0 16px; color: #52525b;">This test email confirms the current email configuration can send messages successfully.</p>
          <p style="margin: 0; color: #71717a;">Workspace URL: ${appUrl}</p>
        </div>
      </div>
    `,
  });

  if (!result) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to send test email" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { success: true, id: result.id } });
}
