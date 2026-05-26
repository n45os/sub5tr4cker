import Link from "next/link";

// page wrapper — centers the document and gives it comfortable reading width
export function LegalContainer({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      {children}
    </article>
  );
}

// document title + effective date + lead paragraph
export function LegalTitle({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-10 border-b border-border/60 pb-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated: <time>{lastUpdated}</time>
      </p>
      {children ? (
        <div className="mt-5 text-sm leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline">
          {children}
        </div>
      ) : null}
    </header>
  );
}

// styles the semantic prose inside legal pages without a typography plugin
export function LegalProse({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "text-sm text-muted-foreground",
        "[&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-12 [&_h2]:mb-3",
        "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-7 [&_h3]:mb-2",
        "[&_p]:mt-3 [&_p]:leading-7",
        "[&_strong]:font-medium [&_strong]:text-foreground",
        "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2",
        "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
        "[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
        "[&_li]:leading-7",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

// optional in-page table of contents for longer documents
export function LegalToc({
  items,
}: {
  items: Array<{ id: string; label: string }>;
}) {
  return (
    <nav
      aria-label="On this page"
      className="my-8 rounded-2xl border border-border/60 bg-muted/25 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        On this page
      </p>
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id} className="text-sm">
            <a
              href={`#${item.id}`}
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {index + 1}. {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// callout shown when operator details are still placeholders, so visitors and the
// operator can tell the policy has not been completed yet
export function PlaceholderNotice() {
  return (
    <div className="mb-8 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="font-medium">This policy has not been finalised for this instance.</p>
      <p className="mt-1.5">
        The operator still needs to fill in their organisation name and contact
        details under{" "}
        <Link href="/dashboard/settings" className="underline underline-offset-2">
          Settings → Legal &amp; privacy
        </Link>
        . Until then, the fields below show placeholders.
      </p>
    </div>
  );
}

// neutral callout box used for "this is a template, not legal advice" notes
export function LegalCallout({ children }: { children: React.ReactNode }) {
  return (
    <aside className="mt-12 rounded-2xl border border-border/60 bg-muted/25 px-5 py-4 text-sm leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline">
      {children}
    </aside>
  );
}
