/**
 * Sidebar's rows, as four component sets on the Sidebar page, which a designer stacks into a
 * navigation panel or an icon rail:
 *
 * - `Sidebar menu button`: `Sidebar.MenuButton` in the recipe's two variants at its three sizes,
 *   inactive and active, in four states, expanded and collapsed to the icon rail, 96 cells. It
 *   holds the docs demos' first row, the House icon and `Dashboard` in a `<span>`, and takes the
 *   Sidebar's `sidebar-foreground` text, which `Sidebar.Root` sets around it. `collapsed=on` holds
 *   `group-data-[collapsible=icon]`, which the collapsed rail stamps around its rows, so the row
 *   draws the rail's 32px square padded 8px, or unpadded at `lg`.
 * - `Sidebar menu sub button`: `Sidebar.MenuSubButton`, an `<a>`, at its two sizes, inactive and
 *   active, in four states, 16 cells, holding the rich menu demo's `Open`. The collapsed rail hides
 *   it, so it has no collapsed cells.
 * - `Sidebar group label`: `Sidebar.GroupLabel` holding `Navigation`, 1 cell. The collapsed rail
 *   fades it out, so it has no collapsed cell.
 * - `Sidebar menu badge`: `Sidebar.MenuBadge` holding `12`, at rest, beside a hovered menu button
 *   and beside an active one, which its `peer-hover/menu-button` and
 *   `peer-data-active/menu-button` arms read, 3 cells.
 *
 * Rows sit 240px wide, the content width of the docs' 16rem Sidebar inside a group's dense 8px
 * row inset, and sub rows 191px, inside the sub menu's margins, padding and border there. The
 * menu actions and the sub menu's border wait for sets of their own, so no row reserves room for
 * an action, and no docs demo shows a floating Sidebar, so no row draws its inner corner.
 */
import {
  sidebarGroupLabelClass,
  sidebarMenuBadgeClass,
  sidebarMenuButtonVariants,
  sidebarMenuSubButtonVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import { swapProperties } from "./component-spec";
import type { Cell, ComponentDefinition, IconSlot, OuterDeclaration } from "./component-spec";
import { ownKey } from "./own-key";

/** The width of a menu row: the docs' 16rem Sidebar less a group's dense 8px row inset each side. */
export const SIDEBAR_ROW_WIDTH = 240;

/**
 * The width of a sub row: a menu row less the sub menu's 14px margins and 10px padding each side
 * and its 1px border.
 */
export const SIDEBAR_SUB_ROW_WIDTH = SIDEBAR_ROW_WIDTH - 2 * 14 - 2 * 10 - 1;

/** The menu button's text, the default of its `Label` property: the docs demos' first row. */
export const SIDEBAR_MENU_BUTTON_TEXT = "Dashboard";

/** The sub button's text, the default of its `Label` property: the rich menu demo's first sub row. */
export const SIDEBAR_SUB_BUTTON_TEXT = "Open";

/** The group label's text, the default of its `Label` property: the docs demos' group label. */
export const SIDEBAR_GROUP_LABEL_TEXT = "Navigation";

/** The badge's text, the default of its `Count` property: the rich menu demo's first badge. */
export const SIDEBAR_BADGE_TEXT = "12";

type MenuButtonVariant = keyof typeof sidebarMenuButtonVariants.variants.variant;
type MenuButtonSize = keyof typeof sidebarMenuButtonVariants.variants.size;
type SubButtonSize = keyof typeof sidebarMenuSubButtonVariants.variants.size;

function isMenuButtonVariant(value: string | undefined): value is MenuButtonVariant {
  return ownKey(sidebarMenuButtonVariants.variants.variant, value);
}

function isMenuButtonSize(value: string | undefined): value is MenuButtonSize {
  return ownKey(sidebarMenuButtonVariants.variants.size, value);
}

function isSubButtonSize(value: string | undefined): value is SubButtonSize {
  return ownKey(sidebarMenuSubButtonVariants.variants.size, value);
}

/** What a `sidebar-menu-button` cell renders. */
export type MenuButtonLook = {
  readonly variant: MenuButtonVariant;
  readonly size: MenuButtonSize;
  readonly active: boolean;
  readonly collapsed: boolean;
};

/**
 * What a `sidebar-menu-button` cell renders.
 *
 * @param cell - A `sidebar-menu-button` cell.
 * @returns Its look.
 * @throws When the cell names a variant or size the recipe does not declare, a defect in the
 *   caller's cell.
 */
export function menuButtonLook(cell: Cell): MenuButtonLook {
  const { variant, size } = cell;
  if (!isMenuButtonVariant(variant) || !isMenuButtonSize(size)) {
    throw new Error(`Sidebar menu button has no variant ${variant ?? ""} or size ${size ?? ""}`);
  }
  return { variant, size, active: cell.active === "on", collapsed: cell.collapsed === "on" };
}

/** What a `sidebar-menu-sub-button` cell renders. */
export type SubButtonLook = {
  readonly size: SubButtonSize;
  readonly active: boolean;
};

/**
 * What a `sidebar-menu-sub-button` cell renders.
 *
 * @param cell - A `sidebar-menu-sub-button` cell.
 * @returns Its look.
 * @throws When the cell names a size the recipe does not declare, a defect in the caller's cell.
 */
export function subButtonLook(cell: Cell): SubButtonLook {
  const { size } = cell;
  if (!isSubButtonSize(size)) {
    throw new Error(`Sidebar menu sub button has no size ${size ?? ""}`);
  }
  return { size, active: cell.active === "on" };
}

/** The menu button's variants and sizes in the recipe's order, its defaults first. */
const MENU_BUTTON_VARIANTS = Object.keys(sidebarMenuButtonVariants.variants.variant).filter(
  isMenuButtonVariant
);
const MENU_BUTTON_SIZES = Object.keys(sidebarMenuButtonVariants.variants.size).filter(isMenuButtonSize);

/** The sub button's sizes in the recipe's order, its default first. */
const SUB_BUTTON_SIZES = Object.keys(sidebarMenuSubButtonVariants.variants.size).filter(isSubButtonSize);

const always = (): boolean => true;

/** The docs demos' House before the first row's label, which the `Icon` swap property picks. */
const HOUSE: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "House",
  swapProperty: "Icon",
};

/** The text color `Sidebar.Root` sets around its rows, which a row that sets none inherits. */
export const SIDEBAR_TEXT: readonly OuterDeclaration[] = [
  {
    className: "Sidebar.Root text-sidebar-foreground",
    property: "color",
    value: "var(--sidebar-foreground)",
  },
];

/** Why no row draws the floating Sidebar's inner corner. */
const FLOATING = "a floating Sidebar, which no docs demo shows";

/** Why a part the collapsed icon rail hides draws no collapsed cell. */
const RAIL_HIDES = "the collapsed icon rail hides it";

/** A row as `Sidebar.MenuButton` holding the House icon and its label in a `<span>`. */
export const SIDEBAR_MENU_BUTTON: ComponentDefinition = {
  key: "sidebar-menu-button",
  name: "Sidebar menu button",
  slot: "sidebar-menu-button",
  // The docs mark an unavailable row `aria-disabled="true"`, which keeps its tooltip, and nothing
  // stamps a state on the row's `<button>`.
  rootKind: "plain-element",
  axes: [
    { name: "variant", values: MENU_BUTTON_VARIANTS },
    { name: "size", values: MENU_BUTTON_SIZES },
    { name: "collapsed", values: ["off", "on"] },
    { name: "active", values: ["off", "on"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  previewWidth: SIDEBAR_ROW_WIDTH,
  inheritedFor: () => SIDEBAR_TEXT,
  classesFor: (cell) => {
    const { variant, size } = menuButtonLook(cell);
    return sidebarMenuButtonVariants({ variant, size });
  },
  states: { disabled: ["aria-disabled"] },
  facts: new Map([
    ["group-data-[collapsible=icon]", (cell: Cell) => menuButtonLook(cell).collapsed],
    ["data-active", (cell: Cell) => menuButtonLook(cell).active],
  ]),
  // A `<button disabled>` row never shows, since the docs disable a row through `aria-disabled`.
  // A row opens no dropdown menu here.
  omittedStates: new Set(["disabled", "data-open"]),
  omittedCompositions: new Map([
    ["in-data-[slot=sidebar-inner]", FLOATING],
    [
      "group-has-data-[slot=sidebar-menu-action]/menu-item",
      "a menu item that holds a menu action, which waits for a set of its own",
    ],
  ]),
  label: {
    key: "text",
    name: "text",
    characters: SIDEBAR_MENU_BUTTON_TEXT,
    textProperty: "Label",
    textElement: { tag: "span", attributes: {} },
    shownIn: always,
  },
  iconsFor: () => [HOUSE],
  swapProperties: swapProperties([HOUSE]),
};

/** A sub row as `Sidebar.MenuSubButton`, an `<a>`, holding its label in a `<span>`. */
export const SIDEBAR_MENU_SUB_BUTTON: ComponentDefinition = {
  key: "sidebar-menu-sub-button",
  name: "Sidebar menu sub button",
  slot: "sidebar-menu-sub-button",
  // An `<a>` takes no `disabled`, so the docs mark an unavailable sub row `aria-disabled="true"`.
  rootKind: "plain-element",
  axes: [
    { name: "size", values: SUB_BUTTON_SIZES },
    { name: "active", values: ["off", "on"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  previewWidth: SIDEBAR_SUB_ROW_WIDTH,
  classesFor: (cell) => sidebarMenuSubButtonVariants({ size: subButtonLook(cell).size }),
  states: { disabled: ["aria-disabled"] },
  facts: new Map([["data-active", (cell: Cell) => subButtonLook(cell).active]]),
  omittedStates: new Set(["disabled"]),
  omittedCompositions: new Map([["group-data-[collapsible=icon]", RAIL_HIDES]]),
  label: {
    key: "text",
    name: "text",
    characters: SIDEBAR_SUB_BUTTON_TEXT,
    textProperty: "Label",
    textElement: { tag: "span", attributes: {} },
    shownIn: always,
  },
  iconsFor: () => [],
  swapProperties: [],
};

/** A group label as `Sidebar.GroupLabel`, a `<div>` holding its text. */
export const SIDEBAR_GROUP_LABEL: ComponentDefinition = {
  key: "sidebar-group-label",
  name: "Sidebar group label",
  slot: "sidebar-group-label",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  previewWidth: SIDEBAR_ROW_WIDTH,
  classesFor: () => sidebarGroupLabelClass,
  states: {},
  facts: new Map(),
  // A `<div>` label takes no focus. A consumer's `render` makes it a control.
  omittedStates: new Set(["focus-visible"]),
  omittedCompositions: new Map([
    ["in-data-[slot=sidebar-inner]", FLOATING],
    [
      "group-data-[collapsible=icon]",
      "the collapsed icon rail fades the label out and pulls the rows below up over it",
    ],
  ]),
  label: {
    key: "text",
    name: "text",
    characters: SIDEBAR_GROUP_LABEL_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: () => [],
  swapProperties: [],
};

/** Why the badge drops the arms that offset it beside a small or large menu button. */
const BADGE_OFFSET =
  "the badge's offset in its menu item beside a small or large menu button, which the set does not draw";

/** A badge as `Sidebar.MenuBadge` beside a menu button, whose state its `peer-*` arms read. */
export const SIDEBAR_MENU_BADGE: ComponentDefinition = {
  key: "sidebar-menu-badge",
  name: "Sidebar menu badge",
  slot: "sidebar-menu-badge",
  statePeer: "sidebar-menu-button",
  axes: [{ name: "state", values: ["rest", "hover", "active"] }],
  columnAxis: "state",
  classesFor: () => sidebarMenuBadgeClass,
  states: {},
  facts: new Map([
    ["peer-hover/menu-button", (cell: Cell) => cell.state === "hover"],
    ["peer-data-active/menu-button", (cell: Cell) => cell.state === "active"],
  ]),
  omittedStates: new Set(),
  omittedCompositions: new Map([
    ["peer-data-[size=lg]/menu-button", BADGE_OFFSET],
    ["peer-data-[size=sm]/menu-button", BADGE_OFFSET],
    ["group-data-[collapsible=icon]", RAIL_HIDES],
  ]),
  label: {
    key: "text",
    name: "text",
    characters: SIDEBAR_BADGE_TEXT,
    textProperty: "Count",
    shownIn: always,
  },
  iconsFor: () => [],
  swapProperties: [],
};
