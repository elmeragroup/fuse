/**
 * The renderers of Sidebar's row sets: each cell as the real Fuse part in the minimal context its
 * classes read, in a host as wide as the kit's preview width, without the panel's own chrome.
 *
 * - A `sidebar-menu-button` cell renders `Sidebar.MenuButton` holding the docs demos' House and
 *   `<span>Dashboard</span>`, in a `Sidebar.MenuItem` in a `Sidebar.Menu`. The host stands for the
 *   desktop `Sidebar.Root` around the rows: it carries the `group` marker, `data-collapsible="icon"`
 *   where the cell is collapsed and an empty one where it is not, as the Root stamps them, and the
 *   Root's `text-sidebar-foreground`. An active cell sets `isActive`, and a disabled cell marks the
 *   row `aria-disabled="true"`, as the docs mark an unavailable row. The page forces hover and focus
 *   on the row.
 * - A `sidebar-menu-sub-button` cell renders `Sidebar.MenuSubButton`, an `<a href>`, holding the rich
 *   menu demo's `<span>Open</span>`, active and disabled as a menu row is.
 * - A `sidebar-group-label` cell renders `Sidebar.GroupLabel` holding `Navigation`.
 * - A `sidebar-menu-badge` cell renders `Sidebar.MenuBadge` holding `12` after a `Sidebar.MenuButton`
 *   in a `Sidebar.MenuItem`, as the rich menu demo places it. The badge reads the button through its
 *   `peer-hover/menu-button:` and `peer-data-active/menu-button:` arms. The button is `hidden`, so its
 *   fill paints nothing behind the badge's crop, which the badge set does not draw. An active cell
 *   sets its `isActive`, and the page forces hover on it, the badge's `statePeer`. The host sets the
 *   badge at the item's left edge, so its crop sits on the pixel grid.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { House } from "../../../fuse/dist/icons.js";
import { Sidebar } from "../../../fuse/dist/sidebar.js";
import type { Cell } from "../components/component-spec.ts";
import {
  menuButtonLook,
  SIDEBAR_BADGE_TEXT,
  SIDEBAR_GROUP_LABEL_TEXT,
  SIDEBAR_MENU_BUTTON_TEXT,
  SIDEBAR_ROW_WIDTH,
  SIDEBAR_SUB_BUTTON_TEXT,
  SIDEBAR_SUB_ROW_WIDTH,
  subButtonLook,
} from "../components/sidebar-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A host of a width around a row. */
function host(width: number, row: ReactElement, around: Readonly<Record<string, string>> = {}): ReactElement {
  return createElement("div", { style: { width: `${width}px` }, ...around }, row);
}

/** The attribute a disabled cell's row carries, as the docs mark an unavailable row. */
function disabledOf(cell: Cell): Readonly<Record<string, string>> {
  return cell.state === "disabled" ? { "aria-disabled": "true" } : {};
}

/** A `sidebar-menu-button` cell: the docs demos' first row, expanded or collapsed. */
export const sidebarMenuButton: CellRendering = {
  element: (cell: Cell) => {
    const look = menuButtonLook(cell);
    return host(
      SIDEBAR_ROW_WIDTH,
      createElement(
        Sidebar.Menu,
        null,
        createElement(
          Sidebar.MenuItem,
          null,
          createElement(
            Sidebar.MenuButton,
            { variant: look.variant, size: look.size, isActive: look.active, ...disabledOf(cell) },
            createElement(House, { "aria-hidden": true }),
            createElement("span", null, SIDEBAR_MENU_BUTTON_TEXT)
          )
        )
      ),
      {
        className: "group text-sidebar-foreground",
        "data-collapsible": look.collapsed ? "icon" : "",
      }
    );
  },
};

/** A `sidebar-menu-sub-button` cell: the rich menu demo's first sub row. */
export const sidebarMenuSubButton: CellRendering = {
  element: (cell: Cell) => {
    const look = subButtonLook(cell);
    return host(
      SIDEBAR_SUB_ROW_WIDTH,
      createElement(
        Sidebar.MenuSubButton,
        { href: "#open", size: look.size, isActive: look.active, ...disabledOf(cell) },
        createElement("span", null, SIDEBAR_SUB_BUTTON_TEXT)
      )
    );
  },
};

/** The `sidebar-group-label` cell: the docs demos' group label. */
export const sidebarGroupLabel: CellRendering = {
  element: () => host(SIDEBAR_ROW_WIDTH, createElement(Sidebar.GroupLabel, null, SIDEBAR_GROUP_LABEL_TEXT)),
};

/**
 * The host classes that set the badge at its menu item's left edge, where `absolute right-1` would
 * put its left edge at the item's width less a text width that is no whole pixel, off the pixel grid
 * the page crops on. Fuse's standalone `styles.css` writes its utilities in no cascade layer, so the
 * host's layered rules need `!` to win. They move the crop and change nothing the badge draws.
 */
const BADGE_AT_START = [
  "[&_[data-slot=sidebar-menu-badge]]:right-auto!",
  "[&_[data-slot=sidebar-menu-badge]]:left-0!",
] as const;

/** A `sidebar-menu-badge` cell: the rich menu demo's first badge beside its hidden menu button. */
export const sidebarMenuBadge: CellRendering = {
  element: (cell: Cell) =>
    host(
      SIDEBAR_ROW_WIDTH,
      createElement(
        Sidebar.MenuItem,
        null,
        createElement(Sidebar.MenuButton, { hidden: true, isActive: cell.state === "active" }),
        createElement(Sidebar.MenuBadge, null, SIDEBAR_BADGE_TEXT)
      ),
      { className: BADGE_AT_START.join(" ") }
    ),
  hostClasses: BADGE_AT_START,
};
