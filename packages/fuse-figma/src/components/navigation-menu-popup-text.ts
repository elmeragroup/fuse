/**
 * The docs Basic demo's popups, as the Navigation menu popup set and its compare renderer both read
 * them. The module imports only the import-free `kit-lengths.ts`, so the compare page's browser
 * bundle can take it.
 */

import { SURFACE_PAD_SM } from "./kit-lengths";

/** A link in a popup's list, with its `href` and its text. */
export type NavigationMenuPopupLink = { readonly href: string; readonly text: string };

/** What one item of the Basic demo shows in the popup: its trigger, its list and the popup's width. */
export type NavigationMenuPopupContent = {
  /** The text of the bar trigger that opens the popup. */
  readonly trigger: string;
  /** The classes the demo gives the list in the item's content. */
  readonly listClass: string;
  /**
   * The popup's width, which Base UI measures from the content and writes as `--popup-width`: the
   * list's width plus the content's `surface-pad-sm` on each side, 4px at both densities.
   */
  readonly popupWidth: number;
  /** The links the list holds, in the demo's order. */
  readonly links: readonly NavigationMenuPopupLink[];
};

/** The values of the set's `content` axis: the Basic demo's two items that open a popup. */
export const NAVIGATION_MENU_POPUP_CONTENTS = ["customers", "business"] as const;

/** A value of the set's `content` axis. */
export type NavigationMenuPopupContentName = (typeof NAVIGATION_MENU_POPUP_CONTENTS)[number];

/** Each item's popup, by the `content` value that draws it. */
export const NAVIGATION_MENU_POPUPS = {
  customers: {
    trigger: "Customers",
    listClass: "grid w-64 gap-1",
    popupWidth: 256 + 2 * SURFACE_PAD_SM,
    links: [
      { href: "#electricity", text: "Electricity" },
      { href: "#solar", text: "Solar panels" },
      { href: "#charging", text: "Home charging" },
    ],
  },
  business: {
    trigger: "Business",
    listClass: "grid w-72 gap-1",
    popupWidth: 288 + 2 * SURFACE_PAD_SM,
    links: [
      { href: "#contracts", text: "Power contracts" },
      { href: "#reporting", text: "Energy reporting" },
    ],
  },
} as const satisfies Readonly<Record<NavigationMenuPopupContentName, NavigationMenuPopupContent>>;

/**
 * The popup a cell's `content` value draws.
 *
 * @param content - The cell's `content` value.
 * @returns The item's popup.
 * @throws When the value names no item of the demo, a defect in the cell.
 */
export function navigationMenuPopupOf(content: string | undefined): NavigationMenuPopupContent {
  const name = NAVIGATION_MENU_POPUP_CONTENTS.find((value) => value === content);
  if (name === undefined) {
    throw new Error(`the docs show no Navigation menu popup ${content ?? ""}`);
  }
  return NAVIGATION_MENU_POPUPS[name];
}
