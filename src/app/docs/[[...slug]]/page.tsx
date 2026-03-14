import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDocContent, getAllDocSlugs } from "@/lib/docs/loader";
import { DOCS_SECTIONS } from "@/lib/docs/config";
import { DocSidebar } from "@/components/docs/doc-sidebar";
import { MarkdownContent } from "@/components/docs/markdown-content";

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return [
    { slug: [] },
    ...slugs.map((s) => ({ slug: s.split("/") })),
  ];
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const fullSlug = slug && slug.length > 0 ? slug.join("/") : null;
  if (!fullSlug) return { title: "Documentation | SubsTrack" };
  const doc = getDocContent(fullSlug);
  if (!doc) return {};
  return {
    title: `${doc.title} | SubsTrack Docs`,
    description: doc.description ?? undefined,
  };
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params;
  const fullSlug = slug && slug.length > 0 ? slug.join("/") : null;

  // docs index
  if (!fullSlug) {
    return (
      <div className="docs-body">
        <DocSidebar currentSlug={null} />
        <main className="docs-index">
          <h1>Documentation</h1>
          <p>
            User guides and technical reference for SubsTrack — shared subscription tracking and payment reminders.
          </p>
          {DOCS_SECTIONS.map((section) => (
            <section key={section.title} className="docs-index-section">
              <h2>{section.title}</h2>
              <ul className="docs-index-list">
                {section.items.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/docs/${item.slug}`}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      </div>
    );
  }

  // single doc
  const doc = getDocContent(fullSlug);
  if (!doc) notFound();

  return (
    <div className="docs-body">
      <DocSidebar currentSlug={fullSlug} />
      <main className="docs-main">
        <div className="docs-main-inner">
          <h1 className="docs-title">{doc.title}</h1>
          {doc.description && (
            <p className="docs-description">{doc.description}</p>
          )}
          <MarkdownContent content={doc.content} />
        </div>
      </main>
    </div>
  );
}
