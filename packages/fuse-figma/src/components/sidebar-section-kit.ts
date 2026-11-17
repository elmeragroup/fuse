/**
 * Sidebar's sections, as five component sets on the Sidebar page, built from instances of its row
 * sets, which a designer stacks into a panel. Each set's manifest names its parts and instances, and
 * the build reads the rest from the set's browser capture in `captures/`.
 *
 * - `Sidebar group`: `Sidebar.Group` holding the `Navigation` group label and a menu of the icon
 *   collapse demo's five rows, `Orders` active, each a `Sidebar menu button` instance that fills the
 *   menu column, expanded and collapsed to the icon rail, 2 cells. Collapsed, the label fades out and
 *   the rows move up by its height, so it draws in no layer, and each row is the menu button's
 *   `collapsed=on` variant.
 * - `Sidebar header`: `Sidebar.Header` holding the app frame demo's `Sidebar.Input`, an `Input`
 *   instance showing `Search orders`, expanded and collapsed, 2 cells.
 * - `Sidebar footer`: `Sidebar.Footer` holding a menu of one large menu button, as the landing
 *   dashboard signs its seller in, with the User icon and the seller's name, expanded and collapsed,
 *   2 cells.
 * - `Sidebar sub menu`: `Sidebar.MenuSub` holding the rich menu demo's three sub rows, `Open` active
 *   and `Archived (small)` at `sm`, each a `Sidebar menu sub button` instance in its `<li>`, behind the
 *   sub menu's left border, 1 cell. The collapsed rail hides the sub menu, so it has no collapsed
 *   cell.
 * - `Sidebar menu item with badge`: `Sidebar.MenuItem` holding the rich menu demo's `Orders` row and
 *   its `12` badge, instances of the menu button and badge sets, inactive and active, 2 cells. The
 *   collapsed rail hides the badge, so the set has no collapsed cell.
 *
 * Each section sits 256px wide, the docs' 16rem Sidebar, as the row sets' 240px rows sit inside a
 * group's dense 8px inset, and the sub menu and the item sit in a 240px menu row. The collapsed cells
 * keep that width, since the `Sidebar` set draws the icon rail's own width.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { INPUT_MANIFEST } from "./input-kit";
import { always } from "./popup-facts";
import {
  SIDEBAR_GROUP_LABEL_MANIFEST,
  SIDEBAR_MENU_BADGE_MANIFEST,
  SIDEBAR_MENU_BUTTON_MANIFEST,
  SIDEBAR_MENU_SUB_BUTTON_MANIFEST,
} from "./sidebar-kit";

/** The width of a section: the docs' 16rem Sidebar. */
export const SIDEBAR_SECTION_WIDTH = 256;

/** The icon collapse demo's rows, in its order, with the icon each shows; `Orders` is active. */
export const SIDEBAR_GROUP_ROWS = [
  { label: "Dashboard", icon: "House" },
  { label: "Orders", icon: "Package" },
  { label: "Customers", icon: "Users" },
  { label: "Invoices", icon: "Receipt" },
  { label: "Reports", icon: "ChartBar" },
] as const;

/** The icon collapse demo's active row. */
export const SIDEBAR_GROUP_ACTIVE_ROW = "Orders";

/** The app frame demo's search field placeholder. */
export const SIDEBAR_INPUT_PLACEHOLDER = "Search orders";

/** The landing dashboard's signed-in seller, whom the footer's large row names. */
export const SIDEBAR_FOOTER_TEXT = "Reodor Felgen";

/** The icon the footer's row shows where the landing dashboard shows the seller's avatar. */
export const SIDEBAR_FOOTER_ICON = "User";

/** The rich menu demo's sub rows, in its order, each with its size and whether it is active. */
export const SIDEBAR_SUB_ROWS = [
  { key: "open", label: "Open", size: "md", active: true },
  { key: "shipped", label: "Shipped", size: "md", active: false },
  { key: "archived", label: "Archived (small)", size: "sm", active: false },
] as const;

/** The rich menu demo's row that holds the first badge. */
export const SIDEBAR_BADGE_ROW = { label: "Orders", icon: "Package" } as const;

const collapsed = (cell: Cell): boolean => cell.collapsed === "on";

/** The axis a section's cells take: expanded and collapsed to the icon rail. */
const COLLAPSED_AXES = [{ name: "collapsed", values: ["off", "on"] }];

/** A menu row's label and icon, and its size and whether it is active where they are not the defaults. */
type MenuRow = {
  readonly label: string;
  readonly icon: string;
  readonly size?: string;
  readonly active?: boolean;
};

/** A menu row's button cell: the default variant at rest, collapsed with its section, active where it is. */
function menuButtonCell(outer: Cell, size: string, active: boolean): Cell {
  return {
    variant: "default",
    size,
    collapsed: outer.collapsed ?? "off",
    active: active || outer.active === "on" ? "on" : "off",
    state: "rest",
  };
}

/** A part's frame with no label or icon of its own. */
function frameManifest(
  key: string,
  slot: string,
  parts: readonly (PartManifest | InstanceManifest)[]
): PartManifest {
  return { key, slot, shownIn: always, label: undefined, iconsFor: () => [], parts };
}

/**
 * A menu row at the default variant, at rest, as an instance of the menu button set, its label and
 * icon given, expanded or collapsed with its section.
 */
function menuButtonManifest(
  key: string,
  { label, icon, size = "default", active = false }: MenuRow
): InstanceManifest {
  return {
    kind: "instance",
    key,
    of: SIDEBAR_MENU_BUTTON_MANIFEST,
    cell: (outer) => menuButtonCell(outer, size, active),
    properties: () => ({ text: { Label: label }, swap: { Icon: icon } }),
    shownIn: always,
    exposed: true,
  };
}

/**
 * The group label in an expanded or a collapsed group, each face its own instance. The collapsed
 * rail fades the label out and pulls the rows up over it, so the collapsed one draws in no layer.
 */
function groupLabelManifest(rail: boolean): InstanceManifest {
  return {
    kind: "instance",
    key: rail ? "label-collapsed" : "label",
    of: SIDEBAR_GROUP_LABEL_MANIFEST,
    cell: () => ({ state: "rest" }),
    shownIn: (cell) => collapsed(cell) === rail,
    exposed: true,
  };
}

/** The group's manifest, which the capture-backed build reads with `captures/sidebar-group.json`. */
export const SIDEBAR_GROUP_MANIFEST: SetManifest = {
  key: "sidebar-group",
  name: "Sidebar group",
  slot: "sidebar-group",
  axes: COLLAPSED_AXES,
  columnAxis: "collapsed",
  label: undefined,
  iconsFor: () => [],
  parts: [
    groupLabelManifest(false),
    groupLabelManifest(true),
    frameManifest("content", "sidebar-group-content", [
      frameManifest(
        "menu",
        "sidebar-menu",
        SIDEBAR_GROUP_ROWS.map((row) =>
          frameManifest(`item-${row.label.toLowerCase()}`, "sidebar-menu-item", [
            menuButtonManifest("button", { ...row, active: row.label === SIDEBAR_GROUP_ACTIVE_ROW }),
          ])
        )
      ),
    ]),
  ],
  swapProperties: [],
};

/** The header's manifest, which the capture-backed build reads with `captures/sidebar-header.json`. */
export const SIDEBAR_HEADER_MANIFEST: SetManifest = {
  key: "sidebar-header",
  name: "Sidebar header",
  slot: "sidebar-header",
  axes: COLLAPSED_AXES,
  columnAxis: "collapsed",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "input",
      of: INPUT_MANIFEST,
      cell: () => ({ content: "placeholder", state: "rest" }),
      slot: "sidebar-input",
      properties: () => ({ text: { Text: SIDEBAR_INPUT_PLACEHOLDER } }),
      shownIn: always,
      exposed: true,
    },
  ],
  swapProperties: [],
};

/** The footer's manifest, which the capture-backed build reads with `captures/sidebar-footer.json`. */
export const SIDEBAR_FOOTER_MANIFEST: SetManifest = {
  key: "sidebar-footer",
  name: "Sidebar footer",
  slot: "sidebar-footer",
  axes: COLLAPSED_AXES,
  columnAxis: "collapsed",
  label: undefined,
  iconsFor: () => [],
  parts: [
    frameManifest("menu", "sidebar-menu", [
      frameManifest("item", "sidebar-menu-item", [
        menuButtonManifest("button", { label: SIDEBAR_FOOTER_TEXT, icon: SIDEBAR_FOOTER_ICON, size: "lg" }),
      ]),
    ]),
  ],
  swapProperties: [],
};

/** The sub menu's manifest, which the capture-backed build reads with `captures/sidebar-menu-sub.json`. */
export const SIDEBAR_MENU_SUB_MANIFEST: SetManifest = {
  key: "sidebar-menu-sub",
  name: "Sidebar sub menu",
  slot: "sidebar-menu-sub",
  axes: [{ name: "rows", values: [String(SIDEBAR_SUB_ROWS.length)] }],
  columnAxis: "rows",
  label: undefined,
  iconsFor: () => [],
  parts: SIDEBAR_SUB_ROWS.map(({ key, label, size, active }) =>
    frameManifest(`item-${key}`, "sidebar-menu-sub-item", [
      {
        kind: "instance",
        key: "button",
        of: SIDEBAR_MENU_SUB_BUTTON_MANIFEST,
        cell: () => ({ size, active: active ? "on" : "off", state: "rest" }),
        properties: () => ({ text: { Label: label } }),
        shownIn: always,
        exposed: true,
      },
    ])
  ),
  swapProperties: [],
};

/**
 * The menu item with a badge's manifest, which the capture-backed build reads with
 * `captures/sidebar-menu-item-with-badge.json`.
 */
export const SIDEBAR_MENU_ITEM_WITH_BADGE_MANIFEST: SetManifest = {
  key: "sidebar-menu-item-with-badge",
  name: "Sidebar menu item with badge",
  slot: "sidebar-menu-item",
  axes: [{ name: "active", values: ["off", "on"] }],
  columnAxis: "active",
  label: undefined,
  iconsFor: () => [],
  parts: [
    menuButtonManifest("button", SIDEBAR_BADGE_ROW),
    {
      kind: "instance",
      key: "badge",
      of: SIDEBAR_MENU_BADGE_MANIFEST,
      cell: (outer) => ({ state: outer.active === "on" ? "active" : "rest" }),
      shownIn: always,
      exposed: true,
    },
  ],
  swapProperties: [],
};
