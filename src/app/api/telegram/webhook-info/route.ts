import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/settings/service";

type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
};

type TelegramWebhookInfoResponse = {
  ok: boolean;
  result?: TelegramWebhookInfo;
  description?: string;
};

export async function GET() {
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

  let token: string | null = null;
  try {
    token = await getSetting("telegram.botToken");
  } catch (error) {
    console.error("webhook-info settings read failed:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Could not read Telegram configuration",
        },
      },
      { status: 500 }
    );
  }

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

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`,
      { method: "GET" }
    );
    const data = (await response.json()) as TelegramWebhookInfoResponse;

    if (!data.ok || !data.result) {
      return NextResponse.json(
        {
          error: {
            code: "EXTERNAL_ERROR",
            message: data.description ?? "Telegram rejected getWebhookInfo",
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ data: data.result });
  } catch (error) {
    console.error("getWebhookInfo request failed:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch Telegram webhook info",
        },
      },
      { status: 500 }
    );
  }
}
