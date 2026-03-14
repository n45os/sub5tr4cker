import type { Metadata } from "next";
import Link from "next/link";
import "./docs.css";

export const metadata: Metadata = {
  title: "Docs | SubsTrack",
  description: "SubsTrack documentation — user guide and technical reference",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="docs-layout">
      <header className="docs-header">
        <Link href="/" className="docs-logo">
          SubsTrack
        </Link>
        <span className="docs-header-label">Docs</span>
      </header>
      <div className="docs-body">
        {children}
      </div>
    </div>
  );
}
