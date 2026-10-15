import { COMPONENT_OUTLINES } from "../generated/component-outlines";
import type { ComponentOutline } from "./docs-model";
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

/** Flat alphabetical list of every published component page. */
export const COMPONENT_NAV: readonly NavItem[] = COMPONENT_OUTLINES.map((component) => ({
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
 * the generated component outlines, which the generation pass globs off the route
 * directories — so the nav cannot list a page the site does not serve, or miss one it does.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  { label: "Overview", items: toNavItems(staticPagesIn("overview")) },
  { label: "Handbook", items: toNavItems(staticPagesIn("handbook")) },
  { label: "Components", items: COMPONENT_NAV },
];

/** The outline of the component page a pathname serves, or `undefined` off the component pages. */
export function componentForPath(pathname: string): ComponentOutline | undefined {
  if (!pathname.startsWith(COMPONENTS_PREFIX)) {
    return undefined;
  }
  const slug = pathname.slice(COMPONENTS_PREFIX.length);
  return COMPONENT_OUTLINES.find((component) => component.slug === slug);
}

/** The on-page TOC of a component page: prose headings, demos, API parts, tokens. */
function tocForComponent(component: ComponentOutline): readonly TocItem[] {
  return [
    ...component.headings,
    ...component.demos.map((demo) => ({ id: demo.id, title: demo.title })),
    { id: API_SECTION_ID, title: "API reference" },
    ...component.partNames.map((name) => ({ id: apiPartAnchor(name), title: name })),
    ...(component.hasTokens ? [{ id: TOKENS_SECTION_ID, title: "Tokens consumed" }] : []),
  ];
}

export function tocForPath(pathname: string): readonly TocItem[] {
  const component = componentForPath(pathname);
  return component === undefined ? [] : tocForComponent(component);
}
