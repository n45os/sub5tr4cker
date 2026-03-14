import { Resend } from "resend";
import { getSetting } from "@/lib/settings/service";

let resend: Resend | null = null;
let resendKey: string | null = null;

async function getResend(): Promise<Resend> {
  const apiKey = await getSetting("email.apiKey");
  if (!apiKey) {
    throw new Error("email.apiKey setting is not configured");
  }

  if (!resend || resendKey !== apiKey) {
    resend = new Resend(apiKey);
    resendKey = apiKey;
  }

  return resend;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(
  params: SendEmailParams
): Promise<{ id: string } | null> {
  const client = await getResend();
  const defaultFrom =
    (await getSetting("email.fromAddress")) || "SubsTrack <noreply@substrack.app>";
  const from = params.from || defaultFrom;

  try {
    const result = await client.emails.send({
      from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });

    if (result.error) {
      console.error("email send error:", result.error);
      return null;
    }

    return { id: result.data?.id ?? "unknown" };
  } catch (error) {
    console.error("email send exception:", error);
    return null;
  }
}
