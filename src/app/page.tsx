import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <span className="font-display font-semibold text-zinc-900 dark:text-zinc-100">
            SubsTrack
          </span>
          <nav className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Documentation
            </Link>
            <Link
              href="/login"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="font-display max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
          Track shared subscriptions. Automate reminders.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          One person pays the bill; SubsTrack splits the cost, sends payment reminders, and tracks who has paid — with email and Telegram.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Get started
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Documentation
          </Link>
        </div>
      </main>
    </div>
  );
}