import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not defined");
    }
    resend = new Resend(apiKey);
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
  const client = getResend();
  const from = params.from || process.env.EMAIL_FROM || "SubsTrack <noreply@substrack.app>";

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
