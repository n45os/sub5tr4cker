import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/settings/service";

/**
 * Register the app's webhook URL with Telegram so the bot receives updates
 * (e.g. when a user opens a deep link and taps Start). Call this after
 * configuring the bot token and webhook secret, and ensure General > App URL
 * is set to your public base URL.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  if ((await getSetting("telegram.enabled")) === "false") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Telegram is disabled for this workspace",
        },
      },
      { status: 400 }
    );
  }

  const token = await getSetting("telegram.botToken");
  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Telegram bot token is not configured",
        },
      },
      { status: 400 }
    );
  }

  const appUrl = await getSetting("general.appUrl");
  if (!appUrl?.trim()) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "General > App URL must be set to your public base URL (e.g. https://yourdomain.com)",
        },
      },
      { status: 400 }
    );
  }

  const base = appUrl.replace(/\/$/, "");
  const webhookUrl = `${base}/api/telegram/webhook`;
  const secretToken = await getSetting("telegram.webhookSecret") || undefined;

  try {
    const body: Record<string, string> = { url: webhookUrl };
    if (secretToken) {
      body.secret_token = secretToken;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };

    if (!data.ok) {
      return NextResponse.json(
        {
          error: {
            code: "EXTERNAL_ERROR",
            message: data.description ?? "Telegram rejected the webhook",
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      data: { ok: true, webhookUrl },
    });
  } catch (err) {
    console.error("setWebhook error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to register webhook with Telegram",
        },
      },
      { status: 500 }
    );
  }
}
