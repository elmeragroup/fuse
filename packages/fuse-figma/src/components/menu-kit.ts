/**
 * The menu parts every menu family shares, as two component sets on the Select page, the first
 * family to hold them. A family's popup holds them as instances.
 *
 * - `Menu group label` is a group's caption, 3 cells. Its `kind` axis picks the family per cell.
 *   `plain` is the label every family but Dropdown menu renders, drawn as Select's, `Select.Label` in
 *   a `Select.Group`. `menu` is Dropdown menu's `DropdownMenu.Label`, and `menu inset` is that label
 *   with `inset`, which pads its start by the room a row's indicator takes.
 * - `Menu separator` is the hairline between groups, 1 cell. A popup draws it across its whole
 *   width, whatever it pads.
 */
import type { IconManifest, InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell, InstanceProperties } from "./component-spec";
import { always } from "./popup-facts";

/** The group label every cell shows, the default of its `Label` property: the docs Groups demo's first. */
export const MENU_GROUP_LABEL_TEXT = "Citrus";

/** Whether a group label cell is Dropdown menu's, `menu` or `menu inset`, rather than the plain one. */
const isDropdownLabel = (cell: Cell): boolean => cell.kind !== "plain";

/**
 * The label's manifest, which the capture-backed build reads with `captures/menu-group-label.json`:
 * `<Select.Label>Citrus</Select.Label>` in a `Select.Group` at `kind=plain`, and
 * `<DropdownMenu.Label>Citrus</DropdownMenu.Label>` in a `DropdownMenu.Group`, `inset` at
 * `kind=menu inset`. Each family names the element's slot.
 */
export const MENU_GROUP_LABEL_MANIFEST: SetManifest = {
  key: "menu-group-label",
  name: "Menu group label",
  slot: "menu-group-label",
  elementSlot: (cell) => (isDropdownLabel(cell) ? "dropdown-menu-label" : "select-label"),
  axes: [{ name: "kind", values: ["plain", "menu", "menu inset"] }],
  columnAxis: "kind",
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

/**
 * The separator's manifest, which the capture-backed build reads with `captures/menu-separator.json`:
 * the hairline between a menu's groups, as `<Select.Separator />`.
 */
export const MENU_SEPARATOR_MANIFEST: SetManifest = {
  key: "menu-separator",
  name: "Menu separator",
  slot: "menu-separator",
  elementSlot: () => "select-separator",
  axes: [{ name: "size", values: ["default"] }],
  columnAxis: "size",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};

/** The key part a menu row or group takes from its label: lowercase, a hyphen for each space. */
const keyOf = (label: string): string => label.toLowerCase().replaceAll(" ", "-");

/** The Check a selected row's indicator holds, fixed, so no swap property picks it. */
export const MENU_CHECK: IconManifest = {
  key: "check",
  name: "Check",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "Check",
  swapProperty: undefined,
};

/**
 * A row of a menu popup, an instance of the family's row set at one cell, its label exposed.
 *
 * @param of - The family's row set's manifest.
 * @param cell - The row set's cell every popup cell shows.
 * @param label - The row's text, which also names its layer.
 * @param shownIn - Whether a popup cell shows the row.
 * @param extra - The instance's other property values, such as a Command row's shortcut caps.
 * @returns The row's instance part.
 */
export function menuRowManifest(
  of: SetManifest,
  cell: Cell,
  label: string,
  shownIn: (cell: Cell) => boolean,
  extra: Omit<InstanceProperties, "text"> = {}
): InstanceManifest {
  return {
    kind: "instance",
    key: `item-${keyOf(label)}`,
    of,
    cell: () => cell,
    properties: () => ({ text: { Label: label }, ...extra }),
    shownIn,
    exposed: true,
  };
}

/**
 * A menu group: an instance of the shared group label, in its plain kind, then the rows.
 *
 * @param group - The group's slot, the slot the family stamps on the label, the label and the rows.
 * @returns The group's part.
 */
export function menuGroupManifest({
  slot,
  labelSlot,
  label,
  rows,
  shownIn,
}: {
  readonly slot: string;
  readonly labelSlot?: string;
  readonly label: string;
  readonly rows: readonly InstanceManifest[];
  readonly shownIn: (cell: Cell) => boolean;
}): PartManifest {
  const caption: InstanceManifest = {
    kind: "instance",
    key: `label-${keyOf(label)}`,
    of: MENU_GROUP_LABEL_MANIFEST,
    cell: () => ({ kind: "plain" }),
    properties: () => ({ text: { Label: label } }),
    shownIn,
    exposed: true,
  };
  return {
    key: `group-${keyOf(label)}`,
    slot,
    shownIn,
    label: undefined,
    iconsFor: () => [],
    parts: [labelSlot === undefined ? caption : { ...caption, slot: labelSlot }, ...rows],
  };
}
