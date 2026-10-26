/**
 * Dropdown menu, as component sets on a page of their own. The shared `Menu group label` on the
 * Select page draws Dropdown menu's caption as its `menu` and `menu inset` kinds.
 *
 * - `Dropdown menu sub trigger` is the row that opens a submenu, in 5 states: 5 cells.
 *   `DropdownMenu.SubTrigger` renders Base UI's `<div role="menuitem"
 *   data-slot="dropdown-menu-sub-trigger">` with the `subTrigger` slot of `dropdownMenuVariants`: the
 *   shared menu row, `row-h` tall, inset by `row-px` and `row-py`, rounded with its popup's inner
 *   corner, holding its text and a CaretRight that `ml-auto` ends the row with. A highlighted row has
 *   DOM focus, which `focus:` paints `accent`, its text and caret `accent-foreground`; a focused one
 *   adds the keyboard focus ring. While its submenu is open, Base UI marks the row
 *   `data-popup-open`, which paints the same `accent` face. A disabled row dims to 50%; Base UI keeps
 *   it focusable and marks it `aria-disabled` and `data-disabled`. Each cell sits at rest in a popup
 *   at its 128px minimum, `min-w-32`, as the docs Submenu demo's rows do, so it is the popup's 128px
 *   less `surface-pad-sm` on each side wide.
 *
 * - `Dropdown menu item` is a row, default and destructive, plain and inset, at rest, highlighted,
 *   focused and disabled: 16 cells. `DropdownMenu.Item` renders Base UI's `<div role="menuitem"
 *   data-slot="dropdown-menu-item">` with the `item` slot: the shared menu row holding an optional
 *   start icon, its own text, and an optional `DropdownMenu.Shortcut` after the text, which `ml-auto`
 *   ends the row with. The kit draws the text filling the room before the shortcut (CSS Flexbox 1
 *   §8.1), the row packed at its start with its 8px gap. The `Icon` property shows the icon, User to
 *   begin with, which the `Icon glyph` swap property picks, and starts false, as the docs Basic demo's rows
 *   show none; the `Shortcut` property shows the shortcut and starts true. The shortcut's ⇧ and ⌘,
 *   which Roboto lacks, take Inter, and its letters `font-sans` (`GlyphFontSpec`). A destructive row paints
 *   its text, and so its icon, `error`, and its highlight `error/10`. An inset row pads its start by
 *   `row-indicator-room`.
 * - `Dropdown menu checkbox item` and `Dropdown menu radio item` are the checkable rows, checked off
 *   and on, in the same 4 states: 8 cells each. Each keeps the indicator's room at its end. Base UI
 *   mounts the indicator's Check only while the row is checked, inside the indicator `<span>` that
 *   sits first in the row, `absolute right-(--row-px)`, which the kit draws in flow after the text,
 *   the row then padding its end by `row-px`. While unchecked, the indicator `<span>` is empty, draws
 *   nothing, and the row keeps its end room.
 *
 * Each row cell sits at rest in an open popup, 160px wide, which a popup the kit picks gives it.
 *
 * The popups, the sub content and the open menu wait: a popup that hugs its rows needs one row to hug
 * while the others fill (probe PM), and a row instance that hugs draws its text at its own width
 * while the row set's text fills (see U39-T3's report).
 */
import {
  dropdownMenuVariants,
  menuItemIndicatorClass,
  menuItemIndicatorRoomClass,
} from "@elmeragroup/fuse/recipe-catalog";

import type {
  AncestorDefinition,
  Cell,
  ComponentDefinition,
  IconSlot,
  PartDefinition,
} from "./component-spec";
import { BASE_UI_CHECKED_FACTS, swapProperties } from "./component-spec";
import {
  DROPDOWN_MENU_CHECKBOX_TEXT,
  DROPDOWN_MENU_ITEM_TEXT,
  DROPDOWN_MENU_RADIO_TEXT,
  DROPDOWN_MENU_SHORTCUT_TEXT,
  DROPDOWN_MENU_SUB_TRIGGER_TEXT,
  DROPDOWN_ROW_CELL_WIDTH,
} from "./dropdown-menu-text";
import { SURFACE_PAD_SM } from "./kit-lengths";
import { DROPDOWN_POPUP_ANCESTOR, DROPDOWN_POPUP_FACTS } from "./menu-kit";
import { always, never, openPopupFacts } from "./popup-facts";

const { item, shortcut, subTrigger, subTriggerCaret } = dropdownMenuVariants();

/**
 * The width a row takes in a Dropdown menu popup at its minimum: `min-w-32`, 128px, less
 * `surface-pad-sm`, 4px at both densities, on each side. The docs Submenu demo's rows are narrower,
 * so its popup is that minimum.
 */
export const DROPDOWN_ROW_WIDTH = 128 - 2 * SURFACE_PAD_SM;

/** The CaretRight that ends the row, fixed, so no swap property picks it. */
const CARET: IconSlot = {
  key: "caret",
  name: "CaretRight",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "CaretRight",
  swapProperty: undefined,
  classes: subTriggerCaret(),
};

/**
 * The row that opens a submenu, as `<DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>` in an
 * open `DropdownMenu.Content`, disabled through its `disabled` prop.
 */
export const DROPDOWN_MENU_SUB_TRIGGER: ComponentDefinition = {
  key: "dropdown-menu-sub-trigger",
  name: "Dropdown menu sub trigger",
  slot: "dropdown-menu-sub-trigger",
  // Base UI's row is a `<div>` that keeps focus while disabled and marks it as it marks a span.
  rootKind: "base-ui-span",
  axes: [{ name: "state", values: ["rest", "highlighted", "focus", "open", "disabled"] }],
  columnAxis: "state",
  classesFor: () => subTrigger(),
  previewWidth: DROPDOWN_ROW_WIDTH,
  ancestorsFor: () => [DROPDOWN_POPUP_ANCESTOR],
  // Base UI moves DOM focus to the highlighted row, and a keyboard user's focus is DOM focus too.
  // An open submenu marks its trigger `data-popup-open`.
  states: { highlighted: ["focus"], focus: ["focus"], open: ["data-popup-open"] },
  facts: new Map<string, (cell: Cell) => boolean>([
    ...openPopupFacts({ open: false }),
    // The docs give the trigger no `inset`, and it takes no tone.
    ["data-inset", never],
    ["data-[variant=destructive]", never],
    ["not-data-[variant=destructive]", always],
  ]),
  omittedStates: new Set(),
  // `data-open:` holds on the popup around the row and not on the row, which one cell cannot say.
  omittedCompositions: new Map([
    [
      "data-open",
      "Base UI marks an open submenu's trigger `data-popup-open`, which the open state draws, and never `data-open`, which only the popup around it carries, for its opening motion",
    ],
    [
      "*",
      "`*:[svg]:` recolors the row's icons only in the destructive tone, which the sub trigger never takes",
    ],
  ]),
  label: {
    key: "label",
    name: "label",
    characters: DROPDOWN_MENU_SUB_TRIGGER_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: () => [CARET],
  swapProperties: [],
};

/** Whether a row cell is destructive. */
const isDestructive = (cell: Cell): boolean => cell.variant === "destructive";

/** Base UI moves DOM focus to the highlighted row, and the shortcut reads the row's focus as its group. */
const ROW_STATES = {
  highlighted: ["focus", "group-focus/dropdown-menu-item"],
  focus: ["focus", "group-focus/dropdown-menu-item"],
};

/** The row's tone and inset, which Fuse stamps as `data-variant` and `data-inset`, beside the popup's facts. */
function rowFacts(
  destructive: (cell: Cell) => boolean,
  inset: (cell: Cell) => boolean
): ReadonlyMap<string, (cell: Cell) => boolean> {
  return new Map<string, (cell: Cell) => boolean>([
    ...DROPDOWN_POPUP_FACTS,
    ["data-[variant=destructive]", destructive],
    ["not-data-[variant=destructive]", (cell) => !destructive(cell)],
    ["data-inset", inset],
  ]);
}

/** `*:[svg]:` on a row, which repaints what the row's own text color already paints. */
const ICON_REPAINT: readonly [string, string] = [
  "*",
  "`*:[svg]:text-error` paints a destructive row's icons `error`, which they already take from the row's own `text-error`, in every state",
];

/** The docs demos' User icon at the row's start, behind the `Icon` property, picked by the `Icon glyph` swap property. */
const USER: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "User",
  swapProperty: "Icon glyph",
  optional: { name: "Icon", defaultValue: false },
};

/** `DropdownMenu.Shortcut`'s `<span>`, after the row's text, behind the `Shortcut` property. */
const SHORTCUT: PartDefinition = {
  key: "shortcut",
  slot: "dropdown-menu-shortcut",
  after: "label",
  shownIn: always,
  optional: { name: "Shortcut", defaultValue: true },
  classesFor: () => shortcut(),
  label: {
    key: "keys",
    name: "keys",
    characters: DROPDOWN_MENU_SHORTCUT_TEXT,
    textProperty: "Shortcut keys",
    shownIn: always,
  },
  iconsFor: () => [],
};

/**
 * A row, as `<DropdownMenu.Item variant inset>Profile <DropdownMenu.Shortcut>⇧⌘P</DropdownMenu.Shortcut>
 * </DropdownMenu.Item>` in an open `DropdownMenu.Content`, with a `<User />` before its text where the
 * `Icon` property is on, disabled through its `disabled` prop.
 */
export const DROPDOWN_MENU_ITEM: ComponentDefinition = {
  key: "dropdown-menu-item",
  name: "Dropdown menu item",
  slot: "dropdown-menu-item",
  // Base UI's row is a `<div>` that keeps focus while disabled and marks it as it marks a span.
  rootKind: "base-ui-span",
  axes: [
    { name: "variant", values: ["default", "destructive"] },
    { name: "inset", values: ["off", "on"] },
    { name: "state", values: ["rest", "highlighted", "focus", "disabled"] },
  ],
  columnAxis: "state",
  classesFor: () => item(),
  previewWidth: DROPDOWN_ROW_CELL_WIDTH,
  ancestorsFor: () => [DROPDOWN_POPUP_ANCESTOR],
  states: ROW_STATES,
  facts: rowFacts(isDestructive, (cell) => cell.inset === "on"),
  omittedStates: new Set(),
  omittedCompositions: new Map([ICON_REPAINT]),
  label: {
    key: "label",
    name: "label",
    characters: DROPDOWN_MENU_ITEM_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: () => [USER],
  parts: [SHORTCUT],
  swapProperties: swapProperties([USER]),
};

const isChecked = (cell: Cell): boolean => cell.checked === "on";

/** The Check Base UI's indicator `<span>` holds inside the row's indicator `<span>`, fixed. */
const CHECK: IconSlot = {
  key: "check",
  name: "Check",
  side: "end",
  direct: false,
  dataIcon: undefined,
  icon: "Check",
  swapProperty: undefined,
};

/** A checkable row's indicator `<span>`, drawn while checked, when Base UI mounts the Check in it. */
function indicatorOf(slot: string): PartDefinition {
  return {
    key: "indicator",
    slot,
    shownIn: isChecked,
    classesFor: () => menuItemIndicatorClass,
    label: undefined,
    iconsFor: () => [CHECK],
  };
}

/** A Dropdown menu radio group, Base UI's classless `<div role="group">` around its rows. */
const RADIO_GROUP_ANCESTOR: AncestorDefinition = {
  slot: "dropdown-menu-radio-group",
  classes: "",
  undrawn: "the radio group, which draws nothing",
};

/** A checkable row: its slot, its indicator's slot, its text and the group around it, if any. */
function checkableRow(fields: {
  readonly key: string;
  readonly name: string;
  readonly slot: string;
  readonly indicator: string;
  readonly characters: string;
  readonly group: readonly AncestorDefinition[];
}): ComponentDefinition {
  return {
    key: fields.key,
    name: fields.name,
    slot: fields.slot,
    rootKind: "base-ui-span",
    axes: [
      { name: "checked", values: ["off", "on"] },
      { name: "state", values: ["rest", "highlighted", "focus", "disabled"] },
    ],
    columnAxis: "state",
    classesFor: () => `${item()} ${menuItemIndicatorRoomClass}`,
    previewWidth: DROPDOWN_ROW_CELL_WIDTH,
    ancestorsFor: () => [DROPDOWN_POPUP_ANCESTOR, ...fields.group],
    states: ROW_STATES,
    facts: new Map([...rowFacts(never, never), ...BASE_UI_CHECKED_FACTS]),
    omittedStates: new Set(),
    omittedCompositions: new Map([ICON_REPAINT]),
    label: {
      key: "label",
      name: "label",
      characters: fields.characters,
      textProperty: "Label",
      shownIn: always,
    },
    iconsFor: () => [],
    parts: [indicatorOf(fields.indicator)],
    // The indicator `<span>` stays in the markup while unchecked, empty, and draws nothing.
    undrawnChildren: (cell) => (isChecked(cell) ? 0 : 1),
    swapProperties: [],
  };
}

/** A checkbox row, as `<DropdownMenu.CheckboxItem checked>Show toolbar</DropdownMenu.CheckboxItem>`. */
export const DROPDOWN_MENU_CHECKBOX_ITEM: ComponentDefinition = checkableRow({
  key: "dropdown-menu-checkbox-item",
  name: "Dropdown menu checkbox item",
  slot: "dropdown-menu-checkbox-item",
  indicator: "dropdown-menu-checkbox-item-indicator",
  characters: DROPDOWN_MENU_CHECKBOX_TEXT,
  group: [],
});

/** A radio row, as `<DropdownMenu.RadioItem value>Status bar</DropdownMenu.RadioItem>` in a radio group. */
export const DROPDOWN_MENU_RADIO_ITEM: ComponentDefinition = checkableRow({
  key: "dropdown-menu-radio-item",
  name: "Dropdown menu radio item",
  slot: "dropdown-menu-radio-item",
  indicator: "dropdown-menu-radio-item-indicator",
  characters: DROPDOWN_MENU_RADIO_TEXT,
  group: [RADIO_GROUP_ANCESTOR],
});
