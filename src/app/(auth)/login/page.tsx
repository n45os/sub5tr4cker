import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const googleEnabled = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
          <div className="w-full max-w-sm space-y-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>
          </div>
        </div>
      }
    >
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
