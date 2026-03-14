export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const params = await searchParams;
  const done = params.done === "1";
  const error = params.error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50">
      <div className="max-w-md w-full text-center space-y-4">
        {done && (
          <>
            <h1 className="text-xl font-semibold text-zinc-900">
              You’re unsubscribed
            </h1>
            <p className="text-zinc-600">
              You won’t receive further reminder emails for this group. You can
              still get updates via Telegram if you’ve linked your account.
            </p>
          </>
        )}
        {error === "invalid" && (
          <>
            <h1 className="text-xl font-semibold text-zinc-900">
              Invalid link
            </h1>
            <p className="text-zinc-600">
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}
        {error === "not_found" && (
          <>
            <h1 className="text-xl font-semibold text-zinc-900">
              Not found
            </h1>
            <p className="text-zinc-600">
              This group or member could not be found.
            </p>
          </>
        )}
        <p className="text-sm text-zinc-500">
          <a
            href="https://github.com/n45os/sub5tr4cker"
            className="underline hover:text-zinc-700"
          >
            sub5tr4cker
          </a>{" "}
          — shared subscription tracking
        </p>
      </div>
    </div>
  );
}
