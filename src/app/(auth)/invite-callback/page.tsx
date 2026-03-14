"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function InviteCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = searchParams.get("token");
  const groupId = searchParams.get("groupId");
  const groupUrl =
    groupId ? `/dashboard/groups/${groupId}` : "/dashboard";
  const loginUrl = `/login${groupId ? `?callbackUrl=${encodeURIComponent(groupUrl)}` : ""}`;

  useEffect(() => {
    if (!token || !groupId) {
      setStatus("error");
      setErrorMessage("Invalid invite link. Missing token or group.");
      return;
    }

    let cancelled = false;

    signIn("magic-invite", { token, redirect: false })
      .then((res) => {
        if (cancelled) return;
        if (res?.ok) {
          setStatus("success");
          window.location.href = groupUrl;
        } else {
          setStatus("error");
          setErrorMessage(
            res?.error === "CredentialsSignin"
              ? "This sign-in link has expired. Please sign in with your email or Google."
              : "Sign-in failed. Please try again or sign in manually."
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Something went wrong. Please try signing in manually.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, groupId, groupUrl]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Signing you in…
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            You’ll be redirected to the group shortly.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Couldn’t sign you in
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {errorMessage}
          </p>
          <Link
            href={loginUrl}
            className="inline-block rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

export default function InviteCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
          <div className="w-full max-w-sm space-y-6 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>
          </div>
        </div>
      }
    >
      <InviteCallbackContent />
    </Suspense>
  );
}
