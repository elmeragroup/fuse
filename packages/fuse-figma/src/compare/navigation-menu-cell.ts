/**
 * The renderers of Navigation menu's bar and row sets: each cell as the real Fuse part in a
 * `NavigationMenu.Root` whose List holds one `NavigationMenu.Item`, in the orientation the set draws.
 *
 * - A `navigation-menu-bar-trigger` cell renders `NavigationMenu.Trigger` holding `Customers` in a
 *   horizontal Root. An open cell names the item's `value` in the Root's `defaultValue`, so Base UI
 *   stamps what it stamps on an open trigger, `data-popup-open`, `data-pressed` and
 *   `aria-expanded="true"`. The item holds no `NavigationMenu.Content`, and the Root renders its popup
 *   through a portal, which static markup leaves out, so no popup renders. A disabled cell sets the
 *   trigger's `disabled`, which Base UI renders as `aria-disabled="true"` and `data-disabled`.
 * - A `navigation-menu-vertical-trigger` cell renders the trigger holding `Electric car` in a vertical
 *   Root that opens its popup on its right, as the docs Nested demo's
 *   `<NavigationMenu.Root orientation="vertical" side="right" align="end">`, in a 288px host.
 * - A `navigation-menu-bar-link` cell renders `NavigationMenu.Link` holding `Overview` in a horizontal
 *   Root, `active` in an active cell, which marks it `data-active` and `aria-current="page"`.
 * - A `navigation-menu-row-link` cell renders the link holding `Electricity` in a vertical Root, in a
 *   256px host.
 *
 * The page forces hover and focus on the trigger or the link. Node cannot load Fuse's TSX source, so
 * this module imports the Fuse build. `cell-renderers.ts` imports this module only after the run found
 * the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { NavigationMenu } from "../../../fuse/dist/navigation-menu.js";
import type { Cell } from "../components/component-spec.ts";
import {
  NAVIGATION_MENU_BAR_LINK_TEXT,
  NAVIGATION_MENU_BAR_TRIGGER_TEXT,
  NAVIGATION_MENU_ROW_LINK_TEXT,
  NAVIGATION_MENU_ROW_LINK_WIDTH,
  NAVIGATION_MENU_VERTICAL_TRIGGER_TEXT,
  NAVIGATION_MENU_VERTICAL_TRIGGER_WIDTH,
  showsActive,
  showsOpen,
} from "../components/navigation-menu-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The value of the Root's one item, which an open cell's `defaultValue` names. */
const ITEM = "item";

/** The props of a horizontal Root, or of a vertical one that opens its popup on its right. */
const HORIZONTAL = { "aria-label": "Main" } as const;
const VERTICAL = { orientation: "vertical", side: "right", align: "end" } as const;

/** A Root of an orientation around one item, open where `open` names the item. */
function root(
  orientation: typeof HORIZONTAL | typeof VERTICAL,
  open: boolean,
  part: ReactElement
): ReactElement {
  return createElement(
    NavigationMenu.Root,
    { ...orientation, defaultValue: open ? ITEM : null },
    createElement(NavigationMenu.List, null, createElement(NavigationMenu.Item, { value: ITEM }, part))
  );
}

/** A host of a width around a Root. */
function host(width: number, menu: ReactElement): ReactElement {
  return createElement("div", { style: { width: `${width}px` } }, menu);
}

/** A trigger holding its text, disabled where the cell is. */
function trigger(cell: Cell, text: string): ReactElement {
  return createElement(NavigationMenu.Trigger, { disabled: cell.state === "disabled" }, text);
}

/** A link holding its text, active where the cell is. */
function link(cell: Cell, href: string, text: string): ReactElement {
  return createElement(NavigationMenu.Link, { href, active: showsActive(cell) }, text);
}

/** A `navigation-menu-bar-trigger` cell: the docs Basic demo's first trigger. */
export const navigationMenuBarTrigger: CellRendering = {
  element: (cell: Cell) => root(HORIZONTAL, showsOpen(cell), trigger(cell, NAVIGATION_MENU_BAR_TRIGGER_TEXT)),
};

/** A `navigation-menu-vertical-trigger` cell: the docs Nested demo's trigger, by its title. */
export const navigationMenuVerticalTrigger: CellRendering = {
  element: (cell: Cell) =>
    host(
      NAVIGATION_MENU_VERTICAL_TRIGGER_WIDTH,
      root(VERTICAL, showsOpen(cell), trigger(cell, NAVIGATION_MENU_VERTICAL_TRIGGER_TEXT))
    ),
};

/** A `navigation-menu-bar-link` cell: the docs Links demo's first link. */
export const navigationMenuBarLink: CellRendering = {
  element: (cell: Cell) => root(HORIZONTAL, false, link(cell, "#overview", NAVIGATION_MENU_BAR_LINK_TEXT)),
};

/** A `navigation-menu-row-link` cell: the docs Basic demo's first row. */
export const navigationMenuRowLink: CellRendering = {
  element: (cell: Cell) =>
    host(
      NAVIGATION_MENU_ROW_LINK_WIDTH,
      root(VERTICAL, false, link(cell, "#electricity", NAVIGATION_MENU_ROW_LINK_TEXT))
    ),
};
