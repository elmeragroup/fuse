import { COMPONENT_OUTLINES } from "../generated/component-outlines";
import type { ComponentOutline, TocItem } from "./docs-model";
import { COMPONENTS_PREFIX, componentHref, staticPagesIn } from "./pages";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  /** Muted, normal-case group label. */
  label: string;
  items: readonly NavItem[];
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

/** The component pages that pass `keep`, alphabetical by their nav label. */
function navItems(keep: (component: ComponentOutline) => boolean): readonly NavItem[] {
  return COMPONENT_OUTLINES.filter(keep)
    .map((component) => ({ href: componentHref(component.slug), label: component.title }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

/** Flat alphabetical list of every published component page, charts included. */
export const COMPONENT_NAV: readonly NavItem[] = navItems(() => true);

/** The SideNav's Components group: every component page outside the chart family. */
const COMPONENTS_GROUP: readonly NavItem[] = navItems((component) => !component.chart);

/** The SideNav's Charts group: the chart family's pages. */
const CHARTS_GROUP: readonly NavItem[] = navItems((component) => component.chart);

function toNavItems(pages: readonly { href: string; label: string }[]): readonly NavItem[] {
  return pages.map((page) => ({ href: page.href, label: page.label }));
}

/**
 * The complete five-group SideNav inventory.
 *
 * Overview, Handbook and Blocks come from the authored page manifest; Components and Charts are
 * derived from the generated component outlines, which the generation pass globs off the route
 * directories — so the nav cannot list a page the site does not serve, or miss one it does.
 * Charts holds the chart entry's pages and sits under Components, and Blocks, the whole apps built
 * from them, comes last.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  { label: "Overview", items: toNavItems(staticPagesIn("overview")) },
  { label: "Handbook", items: toNavItems(staticPagesIn("handbook")) },
  { label: "Components", items: COMPONENTS_GROUP },
  { label: "Charts", items: CHARTS_GROUP },
  { label: "Blocks", items: toNavItems(staticPagesIn("blocks")) },
];

/** The outline of the component page a pathname serves, or `undefined` off the component pages. */
export function componentForPath(pathname: string): ComponentOutline | undefined {
  if (!pathname.startsWith(COMPONENTS_PREFIX)) {
    return undefined;
  }
  const slug = pathname.slice(COMPONENTS_PREFIX.length);
  return COMPONENT_OUTLINES.find((component) => component.slug === slug);
}

/**
 * The on-page TOC of a component page: its prose headings and demos in page order, with the
 * examples nested under Examples, then the API reference with its parts nested, then the tokens.
 */
function tocForComponent(component: ComponentOutline): readonly TocItem[] {
  return [
    ...component.sections,
    {
      id: API_SECTION_ID,
      title: "API reference",
      children: component.partNames.map((name) => ({ id: apiPartAnchor(name), title: name })),
    },
    ...(component.hasTokens ? [{ id: TOKENS_SECTION_ID, title: "Tokens consumed" }] : []),
  ];
}

export function tocForPath(pathname: string): readonly TocItem[] {
  const component = componentForPath(pathname);
  return component === undefined ? [] : tocForComponent(component);
}
