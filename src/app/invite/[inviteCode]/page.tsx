import Link from "next/link";
import { getServerBaseUrl } from "@/lib/server-url";
import { InviteJoinForm } from "@/components/features/invite/invite-join-form";

interface PreviewData {
  groupId: string;
  name: string;
  description: string | null;
  service: { name: string; icon: string | null; url: string | null };
  billing: {
    currentPrice: number;
    currency: string;
    cycleType: string;
  };
  canJoin: boolean;
  inviteLinkEnabled: boolean;
}

interface PageProps {
  params: Promise<{ inviteCode: string }>;
}

async function getPreview(
  inviteCode: string,
  baseUrl: string
): Promise<{ data?: PreviewData; error?: { code: string; message: string } }> {
  const res = await fetch(`${baseUrl}/api/invite/${encodeURIComponent(inviteCode)}`, {
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) {
    return { error: json.error ?? { code: "UNKNOWN", message: "Something went wrong" } };
  }
  return { data: json.data };
}

export default async function InvitePage({ params }: PageProps) {
  const { inviteCode } = await params;
  const baseUrl = await getServerBaseUrl();
  const { data, error } = await getPreview(inviteCode, baseUrl);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <Link
          href="/"
          className="font-display text-xl font-semibold text-foreground"
        >
          sub5tr4cker
        </Link>
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Invalid or expired invite
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <Link
          href="/"
          className="font-display text-xl font-semibold text-foreground"
        >
          sub5tr4cker
        </Link>
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Link
        href="/"
        className="font-display text-xl font-semibold text-foreground"
      >
        sub5tr4cker
      </Link>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            You’re invited to join
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold text-foreground">
            {data.name}
          </h1>
          {data.description ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {data.description}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {data.service.name} · {data.billing.currentPrice} {data.billing.currency}/
            {data.billing.cycleType}
          </p>
        </div>

        {!data.canJoin ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Registration via this link is currently disabled. The group admin may open it again later.
          </div>
        ) : (
          <InviteJoinForm inviteCode={inviteCode} groupName={data.name} />
        )}
      </div>
    </div>
  );
}
