/**
 * Select's open state, as three component sets on the Select page beside the trigger and the shared
 * menu parts: a row, the popup that holds the rows, and the trigger with the popup open below it.
 *
 * - `Select item` is a row, selected off and on, at rest, highlighted and disabled: 6 cells.
 *   `Select.Item` renders Base UI's `<div role="option" data-slot="select-item">`. Its text sits in
 *   Base UI's `ItemText` `<div>`, which fills the row. Base UI mounts the indicator `<span>` only
 *   while the row is selected, so the Check shows there alone. A highlighted row has DOM focus. A
 *   disabled row dims; Base UI keeps it focusable and marks it `aria-disabled` and `data-disabled`.
 *   Each cell sits at rest in an ungrouped popup, as the docs Basic demo's rows do.
 * - `Select popup` is the open popup, `content` flat or grouped: 2 cells, the docs Basic and Groups
 *   demos' rows as instances, a fixed sample with nothing selected. Base UI's listbox `<div>` holds
 *   the rows. The separator between the groups spans the popup.
 * - `Select (open)` is the trigger with its popup open below it, at both trigger sizes: 2 cells. Base
 *   UI places the popup under the trigger, 4px below it, centered on it and as wide as it, at least
 *   144px. The popup aligns its selected row over the trigger only while Fuse's
 *   `alignItemWithTrigger` holds and the pointer opens it, which the kit does not draw.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { MENU_CHECK, MENU_GROUP_LABEL_MANIFEST, MENU_SEPARATOR_MANIFEST } from "./menu-kit";
import { always } from "./popup-facts";
import { SELECT_TRIGGER_MANIFEST } from "./select-trigger-kit";

const isSelected = (cell: Cell): boolean => cell.selected === "on";

/** The text every row cell shows, the default of its `Label` property: the docs Basic demo's first row. */
export const SELECT_ITEM_TEXT = "Apple";

/** The rows of the docs Basic demo, in its order. */
export const SELECT_BASIC_ROWS = ["Apple", "Banana", "Orange", "Pear"] as const;

/** The groups of the docs Groups demo, each with its label and rows, in its order. */
export const SELECT_GROUPS = [
  { label: "Citrus", rows: ["Lemon", "Lime", "Orange"] },
  { label: "Berries", rows: ["Blueberry", "Strawberry"] },
] as const;

/**
 * Base UI's `ItemText` `<div>`, which holds the row's text, and its `ItemIndicator` `<span>`, which it
 * mounts only while the row is selected, named by their places in the row.
 */
const ITEM_PARTS: readonly PartManifest[] = [
  {
    key: "text",
    slot: undefined,
    place: "select-item/0",
    shownIn: always,
    label: {
      key: "label",
      name: "label",
      characters: SELECT_ITEM_TEXT,
      textProperty: "Label",
      shownIn: always,
    },
    iconsFor: () => [],
  },
  {
    key: "indicator",
    slot: undefined,
    place: "select-item/1",
    shownIn: isSelected,
    label: undefined,
    iconsFor: () => [MENU_CHECK],
  },
];

/**
 * The row's manifest, which the capture-backed build reads with `captures/select-item.json`:
 * `<Select.Item value>Apple</Select.Item>` in an open, ungrouped `Select.Content`, selected or not,
 * disabled through its `disabled` prop.
 */
export const SELECT_ITEM_MANIFEST: SetManifest = {
  key: "select-item",
  name: "Select item",
  slot: "select-item",
  axes: [
    { name: "selected", values: ["off", "on"] },
    { name: "state", values: ["rest", "highlighted", "disabled"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: ITEM_PARTS,
  swapProperties: [],
};

const isFlat = (cell: Cell): boolean => cell.content === "flat";
const isGrouped = (cell: Cell): boolean => cell.content === "grouped";

/** A row of the popup's list as a manifest names it, at rest, showing its label. */
function rowManifest(label: string, shownIn: (cell: Cell) => boolean): InstanceManifest {
  return {
    kind: "instance",
    key: `item-${label.toLowerCase()}`,
    of: SELECT_ITEM_MANIFEST,
    cell: () => ({ selected: "off", state: "rest" }),
    properties: () => ({ text: { Label: label } }),
    shownIn,
    exposed: true,
  };
}

/** A group of the popup's list as a manifest names it: its caption, then its rows. */
function groupManifest({ label, rows }: (typeof SELECT_GROUPS)[number]): PartManifest {
  return {
    key: `group-${label.toLowerCase()}`,
    slot: "select-group",
    shownIn: isGrouped,
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        kind: "instance",
        key: `label-${label.toLowerCase()}`,
        of: MENU_GROUP_LABEL_MANIFEST,
        cell: () => ({ kind: "plain" }),
        properties: () => ({ text: { Label: label } }),
        shownIn: isGrouped,
        exposed: true,
      },
      ...rows.map((row) => rowManifest(row, isGrouped)),
    ],
  };
}

/** The popup's list, as a manifest names it at its place: the flat rows, or the groups and their separator. */
const LIST_MANIFEST: PartManifest = {
  key: "list",
  slot: undefined,
  place: "select-content/0",
  shownIn: always,
  label: undefined,
  iconsFor: () => [],
  parts: (() => {
    const [first, second] = SELECT_GROUPS.map(groupManifest);
    const separator: InstanceManifest = {
      kind: "instance",
      key: "separator",
      of: MENU_SEPARATOR_MANIFEST,
      cell: () => ({ size: "default" }),
      shownIn: isGrouped,
    };
    return [
      ...SELECT_BASIC_ROWS.map((row) => rowManifest(row, isFlat)),
      ...(first === undefined || second === undefined ? [] : [first, separator, second]),
    ];
  })(),
};

/**
 * The popup's manifest, which the capture-backed build reads with `captures/select-popup.json`:
 * `<Select.Content>` holding the docs Basic demo's rows or its Groups demo's groups.
 */
export const SELECT_POPUP_MANIFEST: SetManifest = {
  key: "select-popup",
  name: "Select popup",
  slot: "select-content",
  axes: [{ name: "content", values: ["flat", "grouped"] }],
  columnAxis: "content",
  label: undefined,
  iconsFor: () => [],
  parts: [LIST_MANIFEST],
  swapProperties: [],
};

/**
 * The open Select's manifest, which the capture-backed build reads with `captures/select-open.json`:
 * the trigger and the popup it measures, the popup's `sideOffset` as the docs' API reference gives
 * `Select.Content`'s default, and `alignItemWithTrigger` as the renderer passes it, `false`, not the
 * default `true`: the kit draws the popup beside the trigger only.
 */
export const SELECT_OPEN_MANIFEST: SetManifest = {
  key: "select-open",
  name: "Select (open)",
  slot: "select-open",
  axes: [
    { name: "placement", values: ["below"] },
    { name: "size", values: ["default", "sm"] },
  ],
  columnAxis: "size",
  union: ["select-trigger", "select-content"],
  sideOffset: 4,
  alignItemWithTrigger: false,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "trigger",
      of: SELECT_TRIGGER_MANIFEST,
      cell: (outer) => ({
        width: "hug",
        size: outer.size ?? "",
        state: "rest",
        content: "placeholder",
        open: "on",
      }),
      shownIn: always,
    },
    {
      kind: "instance",
      key: "popup",
      of: SELECT_POPUP_MANIFEST,
      cell: () => ({ content: "flat" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
