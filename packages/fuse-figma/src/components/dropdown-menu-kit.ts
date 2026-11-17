/**
 * Dropdown menu's rows, as component sets on a page of their own. The shared `Menu group label` on
 * the Select page draws Dropdown menu's caption as its `menu` and `menu inset` kinds.
 *
 * - `Dropdown menu sub trigger` is the row that opens a submenu, in 5 states: 5 cells.
 *   `DropdownMenu.SubTrigger` renders Base UI's `<div role="menuitem"
 *   data-slot="dropdown-menu-sub-trigger">`, holding its text and a CaretRight that ends the row. A
 *   highlighted row has DOM focus; a focused one adds the keyboard focus ring. While its submenu is
 *   open, Base UI marks the row `data-popup-open`. A disabled row dims; Base UI keeps it focusable
 *   and marks it `aria-disabled` and `data-disabled`. Each cell sits at rest in a popup, as the docs
 *   Submenu demo's rows do.
 * - `Dropdown menu item` is a row, default and destructive, plain and inset, at rest, highlighted,
 *   focused and disabled: 16 cells. `DropdownMenu.Item` renders Base UI's `<div role="menuitem"
 *   data-slot="dropdown-menu-item">`, holding an optional start icon, its own text, and an optional
 *   `DropdownMenu.Shortcut` after the text, which ends the row. The `Icon` property shows the icon,
 *   User to begin with, which the `Icon glyph` swap property picks, and starts false, as the docs
 *   Basic demo's rows show none. The `Shortcut` property shows the shortcut and starts true. A
 *   destructive row takes the `error` tone, and an inset row pads its start by the room a checkable
 *   row's indicator takes.
 * - `Dropdown menu checkbox item` and `Dropdown menu radio item` are the checkable rows, checked off
 *   and on, in the same 4 states: 8 cells each. Base UI mounts the indicator's Check only while the
 *   row is checked. While unchecked, the indicator `<span>` is empty and draws nothing.
 *
 * Each row cell except the sub trigger's is `DROPDOWN_ROW_CELL_WIDTH` wide, a popup width the kit
 * picks. The popups, the sub content and the open menu sit in `dropdown-popup-kit.ts`.
 */
import type { IconManifest, LabelManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import {
  DROPDOWN_MENU_CHECKBOX_TEXT,
  DROPDOWN_MENU_ITEM_TEXT,
  DROPDOWN_MENU_RADIO_TEXT,
  DROPDOWN_MENU_SHORTCUT_TEXT,
  DROPDOWN_MENU_SUB_TRIGGER_TEXT,
  DROPDOWN_ROW_CELL_WIDTH,
} from "./dropdown-menu-text";
import { always } from "./popup-facts";

/** A row's text, the default of its `Label` property. */
const rowLabel = (characters: string): LabelManifest => ({
  key: "label",
  name: "label",
  characters,
  textProperty: "Label",
  shownIn: always,
});

/** The CaretRight that ends the sub trigger, fixed, so no swap property picks it. */
const CARET: IconManifest = {
  key: "caret",
  name: "CaretRight",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "CaretRight",
  swapProperty: undefined,
};

/**
 * The sub trigger's manifest, which the capture-backed build reads with
 * `captures/dropdown-menu-sub-trigger.json`: `<DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>`
 * in an open `DropdownMenu.Content`, disabled through its `disabled` prop.
 */
export const DROPDOWN_MENU_SUB_TRIGGER_MANIFEST: SetManifest = {
  key: "dropdown-menu-sub-trigger",
  name: "Dropdown menu sub trigger",
  slot: "dropdown-menu-sub-trigger",
  axes: [{ name: "state", values: ["rest", "highlighted", "focus", "open", "disabled"] }],
  columnAxis: "state",
  label: rowLabel(DROPDOWN_MENU_SUB_TRIGGER_TEXT),
  iconsFor: () => [CARET],
  swapProperties: [],
};

/** The docs demos' User icon at the row's start, behind the `Icon` property, picked by the `Icon glyph` swap property. */
const USER: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "User",
  swapProperty: "Icon glyph",
  optional: { name: "Icon", defaultValue: false },
};

/**
 * The row's manifest, which the capture-backed build reads with `captures/dropdown-menu-item.json`:
 * `<DropdownMenu.Item variant inset>Profile <DropdownMenu.Shortcut>⇧⌘P</DropdownMenu.Shortcut>
 * </DropdownMenu.Item>` in an open `DropdownMenu.Content`, with a `<User />` before its text where the
 * `Icon` property is on, disabled through its `disabled` prop.
 */
export const DROPDOWN_MENU_ITEM_MANIFEST: SetManifest = {
  key: "dropdown-menu-item",
  name: "Dropdown menu item",
  slot: "dropdown-menu-item",
  axes: [
    { name: "variant", values: ["default", "destructive"] },
    { name: "inset", values: ["off", "on"] },
    { name: "state", values: ["rest", "highlighted", "focus", "disabled"] },
  ],
  columnAxis: "state",
  previewWidth: DROPDOWN_ROW_CELL_WIDTH,
  label: rowLabel(DROPDOWN_MENU_ITEM_TEXT),
  iconsFor: () => [USER],
  parts: [
    {
      key: "shortcut",
      slot: "dropdown-menu-shortcut",
      after: "label",
      shownIn: always,
      optional: { name: "Shortcut", defaultValue: true },
      label: {
        key: "keys",
        name: "keys",
        characters: DROPDOWN_MENU_SHORTCUT_TEXT,
        textProperty: "Shortcut keys",
        shownIn: always,
      },
      iconsFor: () => [],
    },
  ],
  swapProperties: [{ name: "Icon glyph", defaultIcon: "User" }],
};

const isChecked = (cell: Cell): boolean => cell.checked === "on";

/** The Check Base UI's indicator `<span>` holds inside the row's indicator `<span>`, fixed. */
const CHECK: IconManifest = {
  key: "check",
  name: "Check",
  side: "end",
  direct: false,
  dataIcon: undefined,
  icon: "Check",
  swapProperty: undefined,
};

/**
 * A checkable row's manifest: its key, name and slot, its indicator's slot and its text. The
 * indicator `<span>` shows while the row is checked, when Base UI mounts the Check in it.
 */
function checkableRowManifest(row: {
  readonly key: string;
  readonly name: string;
  readonly slot: string;
  readonly indicator: string;
  readonly characters: string;
}): SetManifest {
  return {
    key: row.key,
    name: row.name,
    slot: row.slot,
    axes: [
      { name: "checked", values: ["off", "on"] },
      { name: "state", values: ["rest", "highlighted", "focus", "disabled"] },
    ],
    columnAxis: "state",
    previewWidth: DROPDOWN_ROW_CELL_WIDTH,
    label: rowLabel(row.characters),
    iconsFor: () => [],
    parts: [
      {
        key: "indicator",
        slot: row.indicator,
        shownIn: isChecked,
        label: undefined,
        iconsFor: () => [CHECK],
      },
    ],
    swapProperties: [],
  };
}

/**
 * The checkbox row's manifest, which the capture-backed build reads with
 * `captures/dropdown-menu-checkbox-item.json`: `<DropdownMenu.CheckboxItem checked>Show
 * toolbar</DropdownMenu.CheckboxItem>`.
 */
export const DROPDOWN_MENU_CHECKBOX_ITEM_MANIFEST: SetManifest = checkableRowManifest({
  key: "dropdown-menu-checkbox-item",
  name: "Dropdown menu checkbox item",
  slot: "dropdown-menu-checkbox-item",
  indicator: "dropdown-menu-checkbox-item-indicator",
  characters: DROPDOWN_MENU_CHECKBOX_TEXT,
});

/**
 * The radio row's manifest, which the capture-backed build reads with
 * `captures/dropdown-menu-radio-item.json`: `<DropdownMenu.RadioItem value>Status bar</DropdownMenu.RadioItem>`
 * in a radio group.
 */
export const DROPDOWN_MENU_RADIO_ITEM_MANIFEST: SetManifest = checkableRowManifest({
  key: "dropdown-menu-radio-item",
  name: "Dropdown menu radio item",
  slot: "dropdown-menu-radio-item",
  indicator: "dropdown-menu-radio-item-indicator",
  characters: DROPDOWN_MENU_RADIO_TEXT,
});
