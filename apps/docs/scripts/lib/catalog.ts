/**
 * The docs catalog the generation pass writes to `src/generated/catalog.json`: one document per
 * page the ⌘K search index lists, each component page with the sections its markdown endpoint
 * joins, every other page with none yet, and the `llms.txt` text as the index.
 */

import type { Catalog, CatalogDocument, CatalogSection } from "@elmeragroup/docs-catalog";

import type { SearchEntry } from "../../src/lib/docs-model.ts";

/**
 * The most characters one section may hold. A reader of the catalog can then always return one
 * whole section, whatever page it sits on.
 */
export const SECTION_CHARACTER_LIMIT = 50_000;

/** What the catalog is built from. */
type CatalogInput = {
  /** Every page the search index lists, in its order. */
  readonly entries: readonly SearchEntry[];
  /** The sections of each page that has markdown, keyed by the page's href. */
  readonly sections: ReadonlyMap<string, readonly CatalogSection[]>;
  /** The `llms.txt` text. */
  readonly index: string;
};

/**
 * Builds the catalog from the search index, so it lists the pages ⌘K lists with the same titles,
 * groups, descriptions and keywords.
 *
 * @param input - The search entries, the sections of each page that has them, and the index.
 * @returns The catalog. {@link catalogProblems} says whether it may be written.
 */
export function buildCatalog({ entries, sections, index }: CatalogInput): Catalog {
  return {
    documents: entries.map(({ href, title, group, description, keywords }) => ({
      href,
      title,
      group,
      description,
      keywords,
      sections: sections.get(href) ?? [],
    })),
    index,
  };
}

const CODE_FENCE = /^\s*(?:```|~~~)/u;
const SITE_LINK = /\]\((\/[^)\s]*)\)/gu;

/** The site-relative link targets in a section's markdown, outside its code blocks. */
function siteLinks(markdown: string): readonly string[] {
  let inFence = false;
  return markdown.split("\n").flatMap((line) => {
    if (CODE_FENCE.test(line)) {
      inFence = !inFence;
      return [];
    }
    return inFence ? [] : [...line.matchAll(SITE_LINK)].map((match) => match[1] ?? "");
  });
}

/** Why one link points at nothing, or `null` when its document, and section if it names one, exist. */
function brokenLink(target: string, documents: ReadonlyMap<string, CatalogDocument>): string | null {
  const [path = "", fragment] = target.split("#", 2);
  const href = path.replace(/\.md$/u, "");
  const document = documents.get(href);
  if (document === undefined) return `${target}, which is no document`;
  if (fragment !== undefined && !document.sections.some((section) => section.id === fragment)) {
    return `${target}, which names no section of ${href}`;
  }
  return null;
}

/** The problems of one document's sections: repeated ids, oversized sections and broken links. */
function sectionProblems(
  document: CatalogDocument,
  documents: ReadonlyMap<string, CatalogDocument>
): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const section of document.sections) {
    const at = `${document.href}#${section.id}`;
    if (seen.has(section.id)) problems.push(`${document.href} repeats the section id "${section.id}"`);
    seen.add(section.id);
    if (section.markdown.length > SECTION_CHARACTER_LIMIT) {
      problems.push(
        `${at} holds ${String(section.markdown.length)} characters, over the ${String(SECTION_CHARACTER_LIMIT)} a section may hold`
      );
    }
    for (const target of siteLinks(section.markdown)) {
      const broken = brokenLink(target, documents);
      if (broken !== null) problems.push(`${at} links to ${broken}`);
    }
  }
  return problems;
}

/**
 * Every reason the catalog may not be written: a component route with no sections, two documents
 * with one href, a document that repeats a section id, a section over
 * {@link SECTION_CHARACTER_LIMIT} characters, and a site-relative link outside a code block that
 * points at no document or at no section of one. A link may name the page or its `.md` endpoint.
 *
 * @param catalog - The catalog to check.
 * @param componentHrefs - The href of every component route, each of which must have sections.
 * @returns One line per problem, empty when the catalog may be written.
 */
export function catalogProblems(catalog: Catalog, componentHrefs: readonly string[]): readonly string[] {
  const problems: string[] = [];
  const documents = new Map<string, CatalogDocument>();
  for (const document of catalog.documents) {
    if (documents.has(document.href)) problems.push(`two documents share the href ${document.href}`);
    documents.set(document.href, document);
  }
  for (const href of componentHrefs) {
    if ((documents.get(href)?.sections.length ?? 0) === 0) {
      problems.push(`the component route ${href} has no sections`);
    }
  }
  for (const document of catalog.documents) problems.push(...sectionProblems(document, documents));
  return problems;
}
