// docs navigation and slug config — single source of truth for the sidebar

export interface DocItem {
  slug: string;
  title: string;
}

export interface DocSection {
  title: string;
  items: DocItem[];
}

export const DOCS_SECTIONS: DocSection[] = [
  {
    title: "User guide",
    items: [
      { slug: "user-guide/getting-started", title: "Getting Started" },
      { slug: "user-guide/creating-a-group", title: "Creating a Group" },
      { slug: "user-guide/managing-members", title: "Managing Members" },
      { slug: "user-guide/payment-flow", title: "Payment Flow" },
      { slug: "user-guide/telegram-setup", title: "Telegram Setup" },
      { slug: "user-guide/faq", title: "FAQ" },
    ],
  },
  {
    title: "Technical",
    items: [
      { slug: "technical/architecture", title: "Architecture" },
      { slug: "technical/api-reference", title: "API Reference" },
      { slug: "technical/data-models", title: "Data Models" },
      { slug: "technical/deployment", title: "Deployment" },
      { slug: "technical/environment-variables", title: "Environment Variables" },
      { slug: "technical/contributing", title: "Contributing" },
    ],
  },
];

// flatten for lookup
export const ALL_DOC_SLUGS = DOCS_SECTIONS.flatMap((s) => s.items.map((i) => i.slug));

export function getDocBySlug(slug: string): DocItem | undefined {
  for (const section of DOCS_SECTIONS) {
    const found = section.items.find((i) => i.slug === slug);
    if (found) return found;
  }
  return undefined;
}
