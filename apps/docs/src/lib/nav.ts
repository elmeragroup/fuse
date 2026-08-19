export type NavItem = {
  href: string;
  label: string;
};

export type TocItem = {
  id: string;
  title: string;
};

export const COMPONENT_NAV: readonly NavItem[] = [
  { href: "/components/button", label: "Button" },
  { href: "/components/scroll-area", label: "ScrollArea" },
];

export const BUTTON_TOC: readonly TocItem[] = [
  { id: "variants", title: "Variants" },
  { id: "sizes", title: "Sizes" },
  { id: "pending", title: "Pending" },
  { id: "visually-disabled", title: "Visually disabled" },
  { id: "predictive-intent", title: "Predictive intent" },
];

export const SCROLL_AREA_TOC: readonly TocItem[] = [
  { id: "vertical", title: "Vertical" },
  { id: "horizontal", title: "Horizontal" },
  { id: "always-visible", title: "Always visible" },
];

export function tocForPath(pathname: string): readonly TocItem[] {
  if (pathname === "/components/button") {
    return BUTTON_TOC;
  }
  if (pathname === "/components/scroll-area") {
    return SCROLL_AREA_TOC;
  }
  return [];
}
