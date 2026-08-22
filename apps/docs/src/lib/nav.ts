import { DOCS_COMPONENTS } from "../generated/registry";
import type { DocsComponent } from "./docs-model";
import { staticPagesIn } from "./pages";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  /** Muted, normal-case group label (docs-site.md §3.3). */
  label: string;
  items: readonly NavItem[];
};

export type TocItem = {
  id: string;
  title: string;
};

export const API_SECTION_ID = "api-reference";
export const TOKENS_SECTION_ID = "tokens-consumed";

/** Anchor id for one compound part's generated API table. */
export function apiPartAnchor(partName: string): string {
  return `api-${partName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

const COMPONENTS_PREFIX = "/components/";

export function componentHref(slug: string): string {
  return `${COMPONENTS_PREFIX}${slug}`;
}

/** Flat alphabetical list of every published component page (docs-site.md §3.3). */
export const COMPONENT_NAV: readonly NavItem[] = DOCS_COMPONENTS.map((component) => ({
  href: componentHref(component.slug),
  label: component.title,
})).sort((left, right) => left.label.localeCompare(right.label));

function toNavItems(pages: readonly { href: string; label: string }[]): readonly NavItem[] {
  return pages.map((page) => ({ href: page.href, label: page.label }));
}

/**
 * The complete three-group SideNav inventory (docs-site.md §3.3).
 *
 * Overview and Handbook come from the authored page manifest; Components is derived
 * from the generated registry, so a component page cannot be missing from — or linger
 * in — the nav after its MDX shell appears or disappears.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  { label: "Overview", items: toNavItems(staticPagesIn("overview")) },
  { label: "Handbook", items: toNavItems(staticPagesIn("handbook")) },
  { label: "Components", items: COMPONENT_NAV },
];

/** The one slug → component lookup: the route, its metadata and the TOC all read it. */
export function componentBySlug(slug: string): DocsComponent | undefined {
  return DOCS_COMPONENTS.find((component) => component.slug === slug);
}

export function componentForPath(pathname: string): DocsComponent | undefined {
  if (!pathname.startsWith(COMPONENTS_PREFIX)) {
    return undefined;
  }
  return componentBySlug(pathname.slice(COMPONENTS_PREFIX.length));
}

/** The on-page TOC of a component page: prose headings, demos, API parts, tokens. */
export function tocForComponent(component: DocsComponent): readonly TocItem[] {
  return [
    ...component.headings
      .filter((heading) => heading.depth === 2)
      .map((heading) => ({
        id: heading.id,
        title: heading.title,
      })),
    ...component.demos.map((demo) => ({ id: demo.id, title: demo.title })),
    { id: API_SECTION_ID, title: "API reference" },
    ...component.parts.map((part) => ({ id: apiPartAnchor(part.name), title: part.name })),
    ...(component.tokens.length === 0 ? [] : [{ id: TOKENS_SECTION_ID, title: "Tokens consumed" }]),
  ];
}

export function tocForPath(pathname: string): readonly TocItem[] {
  const component = componentForPath(pathname);
  return component === undefined ? [] : tocForComponent(component);
}
