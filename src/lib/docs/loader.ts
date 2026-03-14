import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { getDocBySlug } from "./config";

const CONTENT_DIR = path.join(process.cwd(), "content/docs");

export interface DocContent {
  slug: string;
  title: string;
  description: string | null;
  content: string;
}

export function getDocContent(slug: string): DocContent | null {
  const doc = getDocBySlug(slug);
  if (!doc) return null;

  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: (data.title as string) || doc.title,
    description: (data.description as string) || null,
    content,
  };
}

import { ALL_DOC_SLUGS } from "./config";

export function getAllDocSlugs(): string[] {
  return ALL_DOC_SLUGS;
}
