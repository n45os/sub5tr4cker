import Link from "next/link";
import { DOCS_SECTIONS } from "@/lib/docs/config";

interface DocSidebarProps {
  currentSlug: string | null;
}

export function DocSidebar({ currentSlug }: DocSidebarProps) {
  return (
    <aside className="docs-sidebar">
      {DOCS_SECTIONS.map((section) => (
        <div key={section.title} className="docs-sidebar-section">
          <div className="docs-sidebar-section-title">{section.title}</div>
          <nav>
            {section.items.map((item) => (
              <Link
                key={item.slug}
                href={`/docs/${item.slug}`}
                className={`docs-sidebar-link ${currentSlug === item.slug ? "active" : ""}`}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}
