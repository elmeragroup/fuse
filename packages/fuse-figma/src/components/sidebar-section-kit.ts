/**
 * Sidebar's sections, as five component sets on the Sidebar page, built from instances of its row
 * sets, which a designer stacks into a panel:
 *
 * - `Sidebar group`: `Sidebar.Group` holding the `Navigation` group label and a menu of the icon
 *   collapse demo's five rows, `Orders` active, each a `Sidebar menu button` instance that fills the
 *   menu column, expanded and collapsed to the icon rail, 2 cells. Collapsed, the label fades out and
 *   pulls the rows up by its own height, so it draws in no layer, and each row is the menu button's
 *   `collapsed=on` variant.
 * - `Sidebar header`: `Sidebar.Header` holding the app frame demo's `Sidebar.Input`, an `Input`
 *   instance showing `Search orders`, which the input's `row-h` height, `background` fill and no
 *   shadow override, expanded and collapsed, 2 cells.
 * - `Sidebar footer`: `Sidebar.Footer` holding a menu of one large menu button, as the landing
 *   dashboard signs its seller in, with the User icon and the seller's name, expanded and collapsed,
 *   2 cells.
 * - `Sidebar sub menu`: `Sidebar.MenuSub` holding the rich menu demo's three sub rows, `Open` active
 *   and `Archived (small)` at `sm`, each a `Sidebar menu sub button` instance in its `<li>`, behind the
 *   sub menu's left border, 1 cell. Each sub row moves 1px left, which the sub menu's paddings draw, 9px
 *   on the left and 11px on the right. The collapsed rail hides the sub menu, so it has no collapsed
 *   cell.
 * - `Sidebar menu item with badge`: `Sidebar.MenuItem` holding the rich menu demo's `Orders` row and
 *   its `12` badge, instances of the menu button and badge sets, inactive and active, 2 cells. The
 *   badge sits 4px from the item's end and centred on the row. The collapsed rail hides the badge, so
 *   the set has no collapsed cell.
 *
 * Each section sits 256px wide, the docs' 16rem Sidebar, as the row sets' 240px rows sit inside a
 * group's dense 8px inset, and the sub menu and the item sit in a 240px menu row. The collapsed cells keep that
 * width: the icon rail is the panel's, which a later set draws.
 */
import {
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarInputClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarMenuSubClass,
  sidebarMenuSubItemClass,
  sidebarSectionClass,
} from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { INPUT } from "./input-kit";
import { DIV_BLOCK } from "./menu-kit";
import {
  SIDEBAR_GROUP_LABEL,
  SIDEBAR_MENU_BADGE,
  SIDEBAR_MENU_BUTTON,
  SIDEBAR_MENU_SUB_BUTTON,
  SIDEBAR_ROW_WIDTH,
  SIDEBAR_TEXT,
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

const always = (): boolean => true;
const collapsed = (cell: Cell): boolean => cell.collapsed === "on";

/** The display the browser's default style sheet gives an `<li>`, which no class of a menu item sets. */
const LI_LIST_ITEM = [
  { className: "user agent style sheet, li", property: "display", value: "list-item" },
] as const;

/** Why no section draws the floating Sidebar's padding and inner corner. */
const FLOATING = "a floating Sidebar, which no docs demo shows";

/** The rail marker every section's cell carries where it is collapsed. */
const RAIL_FACTS: ReadonlyMap<string, (cell: Cell) => boolean> = new Map([
  ["group-data-[collapsible=icon]", collapsed],
]);

/** A part's frame with no label or icon of its own. */
function frame(
  key: string,
  slot: string,
  classes: string,
  parts: readonly (PartDefinition | InstanceDefinition)[]
): PartDefinition {
  return {
    key,
    slot,
    shownIn: always,
    classesFor: () => classes,
    label: undefined,
    iconsFor: () => [],
    parts,
  };
}

/** A `Sidebar.MenuItem`, an `<li>`, holding its parts. */
function menuItem(key: string, parts: readonly InstanceDefinition[]): PartDefinition {
  return {
    ...frame(key, "sidebar-menu-item", sidebarMenuItemClass, parts),
    elementDefaults: LI_LIST_ITEM,
  };
}

/** A menu row's label and icon, and its size and whether it is active where they are not the defaults. */
type MenuRow = {
  readonly label: string;
  readonly icon: string;
  readonly size?: string;
  readonly active?: boolean;
};

/**
 * A menu row at the default variant, at rest, as an instance of the menu button set, its label and
 * icon given, expanded or collapsed with its section.
 */
function menuButton(
  key: string,
  { label, icon, size = "default", active = false }: MenuRow
): InstanceDefinition {
  return {
    kind: "instance",
    key,
    of: SIDEBAR_MENU_BUTTON,
    cell: (outer) => ({
      variant: "default",
      size,
      collapsed: outer.collapsed ?? "off",
      active: active || outer.active === "on" ? "on" : "off",
      state: "rest",
    }),
    properties: () => ({ text: { Label: label }, swap: { Icon: icon } }),
    shownIn: always,
    exposed: true,
  };
}

/**
 * The group label in an expanded or a collapsed group. Instance facts read the inner cell, so each
 * face is its own instance; both keep the layer name `sidebar-group-label`. The collapsed rail fades
 * the label out and pulls the rows up over it, so the collapsed one draws in no layer.
 */
function groupLabel(rail: boolean): InstanceDefinition {
  return {
    kind: "instance",
    key: rail ? "label-collapsed" : "label",
    of: SIDEBAR_GROUP_LABEL,
    cell: () => ({ state: "rest" }),
    facts: new Map([["group-data-[collapsible=icon]", () => rail]]),
    shownIn: (cell) => collapsed(cell) === rail,
    exposed: true,
  };
}

/** The icon collapse demo's group, as `Sidebar.Group` > label + `Sidebar.GroupContent` > menu. */
export const SIDEBAR_GROUP: ComponentDefinition = {
  key: "sidebar-group",
  name: "Sidebar group",
  slot: "sidebar-group",
  axes: [{ name: "collapsed", values: ["off", "on"] }],
  columnAxis: "collapsed",
  previewWidth: SIDEBAR_SECTION_WIDTH,
  inheritedFor: () => SIDEBAR_TEXT,
  classesFor: () => sidebarGroupClass,
  states: {},
  facts: RAIL_FACTS,
  omittedStates: new Set(),
  omittedCompositions: new Map([["in-data-[slot=sidebar-inner]", FLOATING]]),
  label: undefined,
  iconsFor: () => [],
  parts: [
    groupLabel(false),
    groupLabel(true),
    {
      ...frame("content", "sidebar-group-content", sidebarGroupContentClass, [
        frame(
          "menu",
          "sidebar-menu",
          sidebarMenuClass,
          SIDEBAR_GROUP_ROWS.map((row) =>
            menuItem(`item-${row.label.toLowerCase()}`, [
              menuButton("button", { ...row, active: row.label === SIDEBAR_GROUP_ACTIVE_ROW }),
            ])
          )
        ),
      ]),
      elementDefaults: DIV_BLOCK,
    },
  ],
  swapProperties: [],
};

/** The app frame demo's search field: an Input at rest showing its placeholder. */
const SEARCH: InstanceDefinition = {
  kind: "instance",
  key: "input",
  of: INPUT,
  cell: () => ({ content: "placeholder", state: "rest" }),
  slot: "sidebar-input",
  classesFor: () => sidebarInputClass,
  properties: () => ({ text: { Text: SIDEBAR_INPUT_PLACEHOLDER } }),
  shownIn: always,
  exposed: true,
};

/** The app frame demo's header, as `Sidebar.Header` > `Sidebar.Input`. */
export const SIDEBAR_HEADER: ComponentDefinition = {
  key: "sidebar-header",
  name: "Sidebar header",
  slot: "sidebar-header",
  axes: [{ name: "collapsed", values: ["off", "on"] }],
  columnAxis: "collapsed",
  previewWidth: SIDEBAR_SECTION_WIDTH,
  inheritedFor: () => SIDEBAR_TEXT,
  classesFor: () => sidebarSectionClass,
  states: {},
  facts: RAIL_FACTS,
  omittedStates: new Set(),
  omittedCompositions: new Map([["in-data-[slot=sidebar-inner]", FLOATING]]),
  label: undefined,
  iconsFor: () => [],
  parts: [SEARCH],
  swapProperties: [],
};

/** The landing dashboard's footer, as `Sidebar.Footer` > `Sidebar.Menu` > a large menu row. */
export const SIDEBAR_FOOTER: ComponentDefinition = {
  key: "sidebar-footer",
  name: "Sidebar footer",
  slot: "sidebar-footer",
  axes: [{ name: "collapsed", values: ["off", "on"] }],
  columnAxis: "collapsed",
  previewWidth: SIDEBAR_SECTION_WIDTH,
  inheritedFor: () => SIDEBAR_TEXT,
  classesFor: () => sidebarSectionClass,
  states: {},
  facts: RAIL_FACTS,
  omittedStates: new Set(),
  omittedCompositions: new Map([["in-data-[slot=sidebar-inner]", FLOATING]]),
  label: undefined,
  iconsFor: () => [],
  parts: [
    frame("menu", "sidebar-menu", sidebarMenuClass, [
      menuItem("item", [
        menuButton("button", { label: SIDEBAR_FOOTER_TEXT, icon: SIDEBAR_FOOTER_ICON, size: "lg" }),
      ]),
    ]),
  ],
  swapProperties: [],
};

/** A sub row of the rich menu demo, a sub button instance at rest in its `Sidebar.MenuSubItem`. */
function subItem({ key, label, size, active }: (typeof SIDEBAR_SUB_ROWS)[number]): PartDefinition {
  return {
    ...frame(`item-${key}`, "sidebar-menu-sub-item", sidebarMenuSubItemClass, [
      {
        kind: "instance",
        key: "button",
        of: SIDEBAR_MENU_SUB_BUTTON,
        cell: () => ({ size, active: active ? "on" : "off", state: "rest" }),
        properties: () => ({ text: { Label: label } }),
        shownIn: always,
        exposed: true,
      },
    ]),
    elementDefaults: LI_LIST_ITEM,
  };
}

/** The rich menu demo's sub menu, as `Sidebar.MenuSub` > three `Sidebar.MenuSubItem`s. */
export const SIDEBAR_MENU_SUB: ComponentDefinition = {
  key: "sidebar-menu-sub",
  name: "Sidebar sub menu",
  slot: "sidebar-menu-sub",
  axes: [{ name: "rows", values: [String(SIDEBAR_SUB_ROWS.length)] }],
  columnAxis: "rows",
  previewWidth: SIDEBAR_ROW_WIDTH,
  inheritedFor: () => SIDEBAR_TEXT,
  classesFor: () => sidebarMenuSubClass,
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  omittedCompositions: new Map([["group-data-[collapsible=icon]", "the collapsed icon rail hides it"]]),
  label: undefined,
  iconsFor: () => [],
  parts: SIDEBAR_SUB_ROWS.map(subItem),
  swapProperties: [],
};

/** The rich menu demo's first item, as `Sidebar.MenuItem` > its menu button and its badge. */
export const SIDEBAR_MENU_ITEM_WITH_BADGE: ComponentDefinition = {
  key: "sidebar-menu-item-with-badge",
  name: "Sidebar menu item with badge",
  slot: "sidebar-menu-item",
  axes: [{ name: "active", values: ["off", "on"] }],
  columnAxis: "active",
  previewWidth: SIDEBAR_ROW_WIDTH,
  inheritedFor: () => SIDEBAR_TEXT,
  classesFor: () => sidebarMenuItemClass,
  elementDefaults: LI_LIST_ITEM,
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  omittedCompositions: new Map([
    ["group-data-[collapsible=icon]", "the collapsed icon rail hides the badge"],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [
    menuButton("button", SIDEBAR_BADGE_ROW),
    {
      kind: "instance",
      key: "badge",
      of: SIDEBAR_MENU_BADGE,
      cell: (outer) => ({ state: outer.active === "on" ? "active" : "rest" }),
      shownIn: always,
      exposed: true,
    },
  ],
  swapProperties: [],
};
