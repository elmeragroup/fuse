import { COMPONENT_PAGES } from "../generated/component-pages";
import type { ComponentPageEntry } from "./docs-model";
import { staticPagesIn } from "./pages";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  /** Muted, normal-case group label. */
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

/**
 * Anchor id for one prop row of a part's reference, so a single prop is linkable.
 *
 * The prop's own casing survives — `#api-button-isVisuallyDisabled` reads as the prop it
 * names, and a row that a hash points at opens itself.
 */
export function apiPropAnchor(partName: string, propName: string): string {
  return `${apiPartAnchor(partName)}-${propName}`;
}

const COMPONENTS_PREFIX = "/components/";

export function componentHref(slug: string): string {
  return `${COMPONENTS_PREFIX}${slug}`;
}

/** Flat alphabetical list of every published component page. */
export const COMPONENT_NAV: readonly NavItem[] = COMPONENT_PAGES.map((component) => ({
  href: componentHref(component.slug),
  label: component.title,
})).sort((left, right) => left.label.localeCompare(right.label));

function toNavItems(pages: readonly { href: string; label: string }[]): readonly NavItem[] {
  return pages.map((page) => ({ href: page.href, label: page.label }));
}

/**
 * The complete three-group SideNav inventory.
 *
 * Overview and Handbook come from the authored page manifest; Components is derived from
 * the generated component-page manifest, which the generation pass globs off the route
 * directories — so the nav cannot list a page the site does not serve, or miss one it does.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  { label: "Overview", items: toNavItems(staticPagesIn("overview")) },
  { label: "Handbook", items: toNavItems(staticPagesIn("handbook")) },
  { label: "Components", items: COMPONENT_NAV },
];

/** The one slug → page lookup: the route, its metadata and the TOC all read it. */
export function componentBySlug(slug: string): ComponentPageEntry | undefined {
  return COMPONENT_PAGES.find((component) => component.slug === slug);
}

export function componentForPath(pathname: string): ComponentPageEntry | undefined {
  if (!pathname.startsWith(COMPONENTS_PREFIX)) {
    return undefined;
  }
  return componentBySlug(pathname.slice(COMPONENTS_PREFIX.length));
}

/** The on-page TOC of a component page: prose headings, demos, API parts, tokens. */
export function tocForComponent(component: ComponentPageEntry): readonly TocItem[] {
  return [
    ...component.headings
      .filter((heading) => heading.depth === 2)
      .map((heading) => ({
        id: heading.id,
        title: heading.title,
      })),
    ...component.demos.map((demo) => ({ id: demo.id, title: demo.title })),
    { id: API_SECTION_ID, title: "API reference" },
    ...component.partNames.map((name) => ({ id: apiPartAnchor(name), title: name })),
    ...(component.tokens.length === 0 ? [] : [{ id: TOKENS_SECTION_ID, title: "Tokens consumed" }]),
  ];
}

export function tocForPath(pathname: string): readonly TocItem[] {
  const component = componentForPath(pathname);
  return component === undefined ? [] : tocForComponent(component);
}
