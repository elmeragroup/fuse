/**
 * The docs catalog the generation pass writes to `src/generated/catalog.json`: one document per
 * page the ⌘K search index lists, each component page with the sections its markdown endpoint
 * joins, every other page with none yet, and the `llms.txt` text as the index.
 */

import type { Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";

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

/** The origin a document's href is resolved against. Only links that resolve to it are checked. */
const SITE = new URL("https://docs.invalid");

/** The link destinations in a parsed section: each inline link and each reference definition. */
function destinations(node: Nodes): readonly string[] {
  if (node.type === "link" || node.type === "definition") return [node.url];
  return "children" in node ? node.children.flatMap(destinations) : [];
}

/**
 * Why one link destination points at nothing, or `null` when it resolves. The destination
 * resolves against the document's own URL, so a relative link counts, and a link to another
 * origin is not checked. A link resolves when its path names a document and its fragment, if any,
 * names a section of it. A `.md` path names the markdown endpoint, which only a document with
 * sections has. The query plays no part.
 */
function brokenLink(
  destination: string,
  from: string,
  documents: ReadonlyMap<string, CatalogDocument>
): string | null {
  const url = URL.parse(destination, new URL(from, SITE));
  if (url === null) return `${destination}, which is no URL`;
  if (url.origin !== SITE.origin) return null;
  const endpoint = url.pathname.endsWith(".md");
  const href = endpoint ? url.pathname.slice(0, -".md".length) : url.pathname;
  const document = documents.get(href);
  if (document === undefined) return `${destination}, which is no document`;
  if (endpoint && document.sections.length === 0) {
    return `${destination}, which is no markdown endpoint: ${href} has no sections`;
  }
  const fragment = url.hash.slice(1);
  if (fragment !== "" && !document.sections.some((section) => section.id === fragment)) {
    return `${destination}, which names no section of ${href}`;
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
    for (const destination of destinations(fromMarkdown(section.markdown))) {
      const broken = brokenLink(destination, document.href, documents);
      if (broken !== null) problems.push(`${at} links to ${broken}`);
    }
  }
  return problems;
}

/**
 * Every reason the catalog may not be written: a component route with no sections, two documents
 * with one href, a document that repeats a section id, a section over
 * {@link SECTION_CHARACTER_LIMIT} characters, and a link to the site that points at no document,
 * at no section of one, or at the `.md` endpoint of a document without sections. Links are read
 * from the parsed markdown, so code holds none, and a relative or reference-style link counts.
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
