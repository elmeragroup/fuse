/**
 * The ⌘K palette index.
 *
 * Built at docs build from the same two inventories the SideNav renders and `llms.txt`
 * publishes: the authored page manifest and the component pages the generation pass globbed
 * off the route group. Nothing is hand-listed, so the palette cannot drift from the site — a
 * route that disappears disappears from search, and a component page is searchable (with its
 * import specifier, API part names and demo titles as match text) as soon as its `page.mdx`
 * lands.
 */

import type { DocsComponent, SearchEntry, SearchGroup } from "../../src/lib/docs-model.ts";
import type { StaticNavGroup, StaticPage } from "../../src/lib/pages.ts";
import { HOME_PAGE, staticPagesIn } from "../../src/lib/pages.ts";

/** The palette shows the SideNav group label, not the manifest's lower-case key. */
const GROUP_LABELS = {
  overview: "Overview",
  handbook: "Handbook",
} satisfies Record<StaticNavGroup, SearchGroup>;

function pageEntry(
  page: Pick<StaticPage, "href" | "label" | "description">,
  group: SearchGroup
): SearchEntry {
  return {
    href: page.href,
    title: page.label,
    group,
    description: page.description,
    keywords: [page.href],
  };
}

function componentEntry(component: DocsComponent): SearchEntry {
  const keywords = [
    component.slug,
    component.entry,
    ...component.parts.map((part) => part.name),
    ...component.demos.map((demo) => demo.title),
  ];
  return {
    href: `/components/${component.slug}`,
    title: component.title,
    group: "Components",
    description: component.lede,
    keywords: [...new Set(keywords)],
  };
}

/** Every searchable destination, in SideNav order. */
export function buildSearchIndex(components: readonly DocsComponent[]): readonly SearchEntry[] {
  return [
    pageEntry(HOME_PAGE, GROUP_LABELS.overview),
    ...staticPagesIn("overview").map((page) => pageEntry(page, GROUP_LABELS.overview)),
    ...staticPagesIn("handbook").map((page) => pageEntry(page, GROUP_LABELS.handbook)),
    ...components.map(componentEntry),
  ];
}

/** Renders the generated module the palette imports. */
export function renderSearchIndex(components: readonly DocsComponent[]): string {
  return `import type { SearchEntry } from "../lib/docs-model";

/** Every destination the ⌘K palette can navigate to. */
export const SEARCH_ENTRIES: readonly SearchEntry[] = ${JSON.stringify(
    buildSearchIndex(components),
    null,
    2
  )};
`;
}
