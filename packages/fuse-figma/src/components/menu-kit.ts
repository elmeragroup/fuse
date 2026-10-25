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

import type { AncestorDefinition, Cell, ComponentDefinition, OuterDeclaration } from "./component-spec";

const always = (): boolean => true;
const never = (): boolean => false;

/**
 * The display the browser's default style sheet gives a `<div>`, which every menu part and Select's
 * list, group and item text are, and which no class of theirs sets.
 */
export const DIV_BLOCK: readonly OuterDeclaration[] = [
  { className: "user agent style sheet, div", property: "display", value: "block" },
];

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
export const PADDED_CONTENT_WIDTH = SELECT_POPUP_WIDTH - 2 * 4;

/**
 * The variants Base UI stamps on an open Select popup that sits below its trigger, as the kit draws
 * it: `data-open`, the side it places the popup on, and Fuse's `data-align-trigger="false"`, since the
 * kit draws the popup below the trigger rather than over it. The popup's motion classes read them.
 */
export const SELECT_POPUP_FACTS: ReadonlyMap<string, (cell: Cell) => boolean> = new Map([
  ["data-open", always],
  ["data-closed", never],
  ["data-[side=bottom]", always],
  ...["top", "left", "right", "inline-start", "inline-end"].map(
    (side) => [`data-[side=${side}]`, never] as const
  ),
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
export const DROPDOWN_POPUP_FACTS: ReadonlyMap<string, (cell: Cell) => boolean> = new Map([
  ["data-open", always],
  ["data-closed", never],
  ["data-[side=bottom]", always],
  ...["top", "left", "right", "inline-start", "inline-end"].map(
    (side) => [`data-[side=${side}]`, never] as const
  ),
]);

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
