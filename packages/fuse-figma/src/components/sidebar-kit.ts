/**
 * Sidebar's rows, as four component sets on the Sidebar page, which a designer stacks into a
 * navigation panel or an icon rail. Each set's manifest names its axes, label and icons, and the
 * build reads the rest from the set's browser capture in `captures/`.
 *
 * - `Sidebar menu button`: `Sidebar.MenuButton` in the recipe's two variants at its three sizes,
 *   inactive and active, in four states, expanded and collapsed to the icon rail, 96 cells. It
 *   holds the docs demos' first row, the House icon and `Dashboard` in a `<span>`. A collapsed row
 *   draws the rail's 32px square.
 * - `Sidebar menu sub button`: `Sidebar.MenuSubButton`, an `<a>`, at its two sizes, inactive and
 *   active, in four states, 16 cells, holding the rich menu demo's `Open`. The collapsed rail hides
 *   it, so it has no collapsed cells.
 * - `Sidebar group label`: `Sidebar.GroupLabel` holding `Navigation`, 1 cell. The collapsed rail
 *   fades it out, so it has no collapsed cell.
 * - `Sidebar menu badge`: `Sidebar.MenuBadge` holding `12`, at rest, beside a hovered menu button
 *   and beside an active one, 3 cells. The capture sets each state on the menu button beside the
 *   badge.
 *
 * Rows sit 240px wide, the content width of the docs' 16rem Sidebar inside a group's dense 8px
 * row inset, and sub rows 191px, inside the sub menu's margins, padding and border there. The
 * menu actions and the sub menu's border wait for sets of their own, so no row reserves room for
 * an action. No docs demo shows a floating Sidebar, so no row draws its inner corner.
 */
import { sidebarMenuButtonVariants, sidebarMenuSubButtonVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { IconManifest, LabelManifest, SetManifest } from "../capture/manifest";
import { swapProperties } from "./component-spec";
import type { Cell } from "./component-spec";
import { ownKey } from "./own-key";
import { always } from "./popup-facts";

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

/** The docs demos' House before the first row's label, which the `Icon` swap property picks. */
const HOUSE: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "House",
  swapProperty: "Icon",
};

/** A label as a manifest names it, its text in the cell's element, which the capture reads. */
function textManifest(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: always };
}

/**
 * The menu button's manifest, which the capture-backed build reads with
 * `captures/sidebar-menu-button.json`. Its renderer gives it the row's host, which the capture
 * measures.
 */
export const SIDEBAR_MENU_BUTTON_MANIFEST: SetManifest = {
  key: "sidebar-menu-button",
  name: "Sidebar menu button",
  slot: "sidebar-menu-button",
  axes: [
    { name: "variant", values: MENU_BUTTON_VARIANTS },
    { name: "size", values: MENU_BUTTON_SIZES },
    { name: "collapsed", values: ["off", "on"] },
    { name: "active", values: ["off", "on"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  label: textManifest(SIDEBAR_MENU_BUTTON_TEXT, "Label"),
  iconsFor: () => [HOUSE],
  swapProperties: swapProperties([HOUSE]),
};

/** The sub button's manifest, which the capture-backed build reads with `captures/sidebar-menu-sub-button.json`. */
export const SIDEBAR_MENU_SUB_BUTTON_MANIFEST: SetManifest = {
  key: "sidebar-menu-sub-button",
  name: "Sidebar menu sub button",
  slot: "sidebar-menu-sub-button",
  axes: [
    { name: "size", values: SUB_BUTTON_SIZES },
    { name: "active", values: ["off", "on"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  label: textManifest(SIDEBAR_SUB_BUTTON_TEXT, "Label"),
  iconsFor: () => [],
  swapProperties: [],
};

/** The group label's manifest, which the capture-backed build reads with `captures/sidebar-group-label.json`. */
export const SIDEBAR_GROUP_LABEL_MANIFEST: SetManifest = {
  key: "sidebar-group-label",
  name: "Sidebar group label",
  slot: "sidebar-group-label",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: textManifest(SIDEBAR_GROUP_LABEL_TEXT, "Label"),
  iconsFor: () => [],
  swapProperties: [],
};

/**
 * The badge's manifest, which the capture-backed build reads with `captures/sidebar-menu-badge.json`:
 * its state lands on the menu button beside it, whose `peer-*` arms the badge reads.
 */
export const SIDEBAR_MENU_BADGE_MANIFEST: SetManifest = {
  key: "sidebar-menu-badge",
  name: "Sidebar menu badge",
  slot: "sidebar-menu-badge",
  statePeer: "sidebar-menu-button",
  axes: [{ name: "state", values: ["rest", "hover", "active"] }],
  columnAxis: "state",
  label: textManifest(SIDEBAR_BADGE_TEXT, "Count"),
  iconsFor: () => [],
  swapProperties: [],
};
