"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface LoginFormProps {
  mode: "local" | "advanced";
}

export function LoginForm({ mode }: LoginFormProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  // local mode auto-logs-in via cookie; bounce to the dashboard immediately
  useEffect(() => {
    if (mode === "local") {
      router.replace(callbackUrl);
    }
  }, [mode, callbackUrl, router]);

  if (mode === "local") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">
            Local mode — redirecting to dashboard…
          </p>
        </div>
      </div>
    );
  }

  const loginHref = `/api/auth/n450s/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link
            href="/"
            className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100"
          >
            sub5tr4cker
          </Link>
          <h1 className="font-display mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            n450s is the identity provider for the n450s ecosystem. You can sign
            in with email, Google, or any provider configured there.
          </p>
        </div>

        <a
          href={loginHref}
          className="block w-full rounded-md bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Continue with n450s
        </a>
      </div>
    </div>
  );
}
