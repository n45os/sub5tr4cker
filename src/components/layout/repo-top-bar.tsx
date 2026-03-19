import { Github } from "lucide-react";
import { REPO_URL } from "@/lib/site";

export function RepoTopBar() {
  const label = REPO_URL.replace(/^https:\/\//, "");

  return (
    <div className="border-b border-border/60 bg-muted/40 px-4 py-1.5 text-center text-xs lg:px-8">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center justify-center gap-1.5 break-all text-muted-foreground hover:text-foreground"
      >
        <Github className="size-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="sr-only">Open source repository — </span>
        <span className="font-mono">{label}</span>
      </a>
    </div>
  );
}
