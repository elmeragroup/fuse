/**
 * The menu parts every menu family shares, as two component sets on the Select page, the first
 * family to hold them. Each draws the shared class of `menu-row-classes.ts`, and a family's popup
 * holds them as instances.
 *
 * - `Menu group label` is a group's caption: `text-xs`, the row inset across and 6px down, in
 *   `muted-foreground`, 3 cells. Its `kind` axis picks the family per cell. `plain` is the label every
 *   family but Dropdown menu renders, drawn as Select's, `Select.Label` in a `Select.Group`. `menu` is
 *   Dropdown menu's `DropdownMenu.Label`, which adds `font-medium`, and `menu inset` is that label with
 *   `inset`, which pads its start by the row inset plus the 16px indicator and its 8px gap, as
 *   `row-indicator-room`. Each cell is as wide as its popup pads it: 144px less `surface-pad-sm` on
 *   each side, 4px at both densities. Select's popup is 144px wide in the docs Groups demo, and the
 *   Dropdown cells draw their popup at that width.
 * - `Menu separator` is the hairline between groups: 1px of `border`, 4px from what sits above and
 *   below it, with negative side margins that cancel its popup's padding, 1 cell. A popup draws it
 *   across its whole width, whatever it pads. Alone, the cell draws it as a popup 144px wide that
 *   pads 4px across holds it, as Dropdown menu's popup does: its 136px container's width widened by
 *   its margins to 144px. Alone, its margins above and below space it from nothing the set draws.
 */
import {
  dropdownMenuVariants,
  menuGroupLabelClass,
  menuSeparatorClass,
  selectContentVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import type {
  AncestorDefinition,
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  InstanceProperties,
  PartDefinition,
} from "./component-spec";
import { DIV_BLOCK } from "./element-defaults";
import { SURFACE_PAD_SM } from "./kit-lengths";
import { always, never, openPopupFacts } from "./popup-facts";

/** The group label every cell shows, the default of its `Label` property: the docs Groups demo's first. */
export const MENU_GROUP_LABEL_TEXT = "Citrus";

/** The width of the Groups demo's popup, which a group pads by 4px on each side. */
export const SELECT_POPUP_WIDTH = 144;

/**
 * The width a box that pads `surface-pad-sm` across gives what it holds inside a Select popup: the
 * popup's, less 4px on each side, at both densities. A Select group gives its label this width, and a
 * popup that pads its rows so gives its separator this width, which the separator's margins widen
 * back to the popup's.
 */
export const PADDED_CONTENT_WIDTH = SELECT_POPUP_WIDTH - 2 * SURFACE_PAD_SM;

/**
 * The variants Base UI stamps on an open Select popup that sits below its trigger, as the kit draws
 * it: `data-open`, the side it places the popup on, and Fuse's `data-align-trigger="false"`, since the
 * kit draws the popup below the trigger rather than over it. The popup's motion classes read them.
 */
export const SELECT_POPUP_FACTS: ReadonlyMap<string, (cell: Cell) => boolean> = new Map([
  ...openPopupFacts(),
  ["data-[align-trigger=true]", never],
]);

const { content, group } = selectContentVariants();

/** The open Select popup around a row or a group, which the row inherits its text color and inner corner from. */
export const SELECT_POPUP_ANCESTOR: AncestorDefinition = {
  slot: "select-content",
  classes: content(),
  undrawn: "the popup's surface, width and motion, which the Select popup set draws",
};

/** A Select group around a label or a row, which publishes the inner corner its rows round with. */
export const SELECT_GROUP_ANCESTOR: AncestorDefinition = {
  slot: "select-group",
  classes: group(),
  undrawn: "the group's padding, which the Select popup set draws around its rows",
};

/**
 * The variants Base UI stamps on an open Dropdown menu popup below its trigger: `data-open` and the
 * side it places the popup on, which the popup's motion classes read.
 */
export const DROPDOWN_POPUP_FACTS: ReadonlyMap<string, (cell: Cell) => boolean> = openPopupFacts();

const dropdownMenu = dropdownMenuVariants();

/** The open Dropdown menu popup around a row or a group, which the row inherits its text color and inner corner from. */
export const DROPDOWN_POPUP_ANCESTOR: AncestorDefinition = {
  slot: "dropdown-menu-content",
  classes: dropdownMenu.content(),
  undrawn: "the popup's surface, padding and motion, which the Dropdown menu sets draw around their rows",
};

/** A Dropdown menu group, Base UI's classless `<div role="group">` around a label and its rows. */
const DROPDOWN_GROUP_ANCESTOR: AncestorDefinition = {
  slot: "dropdown-menu-group",
  classes: "",
  undrawn: "the group, which draws nothing",
};

/** Whether a group label cell is Dropdown menu's, `menu` or `menu inset`, rather than the plain one. */
const isDropdownLabel = (cell: Cell): boolean => cell.kind !== "plain";

/**
 * A group's caption: `<Select.Label>Citrus</Select.Label>` in a `Select.Group` at `kind=plain`, and
 * `<DropdownMenu.Label>Citrus</DropdownMenu.Label>` in a `DropdownMenu.Group`, `inset` at
 * `kind=menu inset`.
 */
export const MENU_GROUP_LABEL: ComponentDefinition = {
  key: "menu-group-label",
  name: "Menu group label",
  slot: "menu-group-label",
  // Each family names the element's slot, which ends `-label` in both.
  element: { tag: "div", attributes: {}, suffixes: { "data-slot": "-label" } },
  elementSlot: (cell) => (isDropdownLabel(cell) ? "dropdown-menu-label" : "select-label"),
  axes: [{ name: "kind", values: ["plain", "menu", "menu inset"] }],
  columnAxis: "kind",
  classesFor: (cell) => (isDropdownLabel(cell) ? dropdownMenu.label() : menuGroupLabelClass),
  previewWidth: PADDED_CONTENT_WIDTH,
  ancestorsFor: (cell) =>
    isDropdownLabel(cell)
      ? [DROPDOWN_POPUP_ANCESTOR, DROPDOWN_GROUP_ANCESTOR]
      : [SELECT_POPUP_ANCESTOR, SELECT_GROUP_ANCESTOR],
  elementDefaults: DIV_BLOCK,
  states: {},
  facts: new Map([
    ...SELECT_POPUP_FACTS,
    // Fuse stamps `data-inset` on an inset Dropdown menu label.
    ["data-inset", (cell: Cell) => cell.kind === "menu inset"],
  ]),
  omittedStates: new Set(),
  label: {
    key: "label",
    name: "label",
    characters: MENU_GROUP_LABEL_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: () => [],
  swapProperties: [],
};

/** The hairline between a menu's groups, as `<Select.Separator />` in a popup that pads 4px across. */
export const MENU_SEPARATOR: ComponentDefinition = {
  key: "menu-separator",
  name: "Menu separator",
  slot: "menu-separator",
  element: { tag: "div", attributes: { "data-slot": "select-separator" } },
  elementSlot: () => "select-separator",
  axes: [{ name: "size", values: ["default"] }],
  columnAxis: "size",
  classesFor: () => menuSeparatorClass,
  previewWidth: PADDED_CONTENT_WIDTH,
  elementDefaults: DIV_BLOCK,
  states: {},
  // Base UI stamps `data-orientation="horizontal"` on the separator.
  facts: new Map([
    ["data-horizontal", always],
    ["data-vertical", never],
  ]),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};

/** The key part a menu row or group takes from its label: lowercase, a hyphen for each space. */
const keyOf = (label: string): string => label.toLowerCase().replaceAll(" ", "-");

/** The Check a selected row's indicator holds, fixed, so no swap property picks it. */
export const MENU_CHECK: IconSlot = {
  key: "check",
  name: "Check",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "Check",
  swapProperty: undefined,
  classes: "pointer-events-none",
};

/**
 * A row of a menu popup, an instance of the family's row set at one cell, its label exposed.
 *
 * @param of - The family's row set.
 * @param cell - The row set's cell every popup cell shows.
 * @param label - The row's text, which also names its layer.
 * @param shownIn - Whether a popup cell shows the row.
 * @param extra - The instance's other property values, such as a Command row's shortcut caps.
 * @returns The row's instance part.
 */
export function menuRowPart(
  of: ComponentDefinition,
  cell: Cell,
  label: string,
  shownIn: (cell: Cell) => boolean,
  extra: Omit<InstanceProperties, "text"> = {}
): InstanceDefinition {
  return {
    kind: "instance",
    key: `item-${keyOf(label)}`,
    of,
    cell: () => cell,
    // The instance carries a label only where it differs from the row set's own.
    properties: () => ({ text: { Label: label }, ...extra }),
    shownIn,
    exposed: true,
  };
}

/** A menu group: its element, its label and the rows it holds. */
export type MenuGroup = {
  /** The group's `data-slot`. */
  readonly slot: string;
  /** The group's classes, empty for Base UI's classless `<div role="group">`. */
  readonly classes: string;
  /** The `data-slot` the family stamps on the shared label, undefined where it keeps its own. */
  readonly labelSlot?: string;
  /** The group's caption, which also names its layers. */
  readonly label: string;
  /** The group's rows, each from {@link menuRowPart}. */
  readonly rows: readonly InstanceDefinition[];
  /** Whether a popup cell shows the group. */
  readonly shownIn: (cell: Cell) => boolean;
};

/**
 * A menu group holding an instance of the shared group label and its rows.
 *
 * @param group - The group's slot, classes, label and rows.
 * @returns The group's part.
 */
export function menuGroupPart({ slot, classes, labelSlot, label, rows, shownIn }: MenuGroup): PartDefinition {
  const caption: InstanceDefinition = {
    kind: "instance",
    key: `label-${keyOf(label)}`,
    of: MENU_GROUP_LABEL,
    // Every family but Dropdown menu renders the plain label, class for class.
    cell: () => ({ kind: "plain" }),
    properties: () => ({ text: { Label: label } }),
    shownIn,
    exposed: true,
  };
  return {
    key: `group-${keyOf(label)}`,
    slot,
    shownIn,
    classesFor: () => classes,
    elementDefaults: DIV_BLOCK,
    label: undefined,
    iconsFor: () => [],
    parts: [labelSlot === undefined ? caption : { ...caption, slot: labelSlot }, ...rows],
  };
}

/** A separator between a menu's groups, as a family stamps it. */
export type MenuSeparator = {
  /** The instance layer's key, `separator` by default. */
  readonly key?: string;
  /** The `data-slot` the family stamps on the shared separator, undefined where it keeps its own. */
  readonly slot?: string;
  /** The classes the family passes the separator, undefined for none. */
  readonly classes?: string;
  /** Whether a popup cell shows the separator. */
  readonly shownIn: (cell: Cell) => boolean;
};

/**
 * An instance of the shared separator.
 *
 * @param separator - The family's key, slot, classes and the cells that show it.
 * @returns The separator's instance part.
 */
export function menuSeparatorPart({
  key = "separator",
  slot,
  classes,
  shownIn,
}: MenuSeparator): InstanceDefinition {
  const separator: InstanceDefinition = {
    kind: "instance",
    key,
    of: MENU_SEPARATOR,
    cell: () => ({ size: "default" }),
    shownIn,
  };
  const slotted = slot === undefined ? separator : { ...separator, slot };
  return classes === undefined ? slotted : { ...slotted, classesFor: () => classes };
}
