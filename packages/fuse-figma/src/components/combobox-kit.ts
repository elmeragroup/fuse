/**
 * Combobox's open state, as component sets on a page of their own: a row, the empty state, the popup
 * that holds them, and the input with the popup open below it. The rows share `Menu group label` and
 * `Menu separator` with the other menu families.
 *
 * - `Combobox item` is a row, selected off and on, at rest, highlighted and disabled: 6 cells.
 *   `Combobox.Item` renders Base UI's `<div role="option" data-slot="combobox-item">`. Its text is the
 *   row's own, and Base UI mounts the indicator `<span>` after it only while the row is selected. Base
 *   UI marks a highlighted row `data-highlighted`, and the input keeps DOM focus. A disabled row dims.
 * - `Combobox empty` is the popup's message while no row matches the input: `No results.`, 1 cell.
 *   Fuse hides it until Base UI marks the popup `data-empty`.
 * - `Combobox popup` is the open popup, `content` flat, grouped and empty: 3 cells, the docs Basic and
 *   Groups demos' rows as instances, a fixed sample with nothing selected, and the empty message with
 *   no rows. Its anchor is the `<input>` inside `Combobox.Input`'s Input group, not the group. Its
 *   list holds the rows.
 * - `Combobox (open)` is the Input group of `Combobox.Input` while its popup is open, and the popup
 *   below it holding the Basic demo's rows, 1 cell. The input is the Input group set's
 *   `form=caret open`. Base UI places the popup 6px below the Input group, aligned to its start.
 *
 * The popup and the open Combobox sample an Input group `COMBOBOX_INPUT_GROUP_WIDTH` wide, 384px.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import {
  COMBOBOX_INPUT_GROUP_WIDTH,
  COMBOBOX_BASIC_ROWS,
  COMBOBOX_EMPTY_TEXT,
  COMBOBOX_GROUPS,
  COMBOBOX_ITEM_TEXT,
} from "./combobox-text";
import type { Cell } from "./component-spec";
import { INPUT_GROUP_MANIFEST } from "./input-group-kit";
import { MENU_CHECK, MENU_GROUP_LABEL_MANIFEST, MENU_SEPARATOR_MANIFEST } from "./menu-kit";
import { always } from "./popup-facts";

const isFlat = (cell: Cell): boolean => cell.content === "flat";
const isGrouped = (cell: Cell): boolean => cell.content === "grouped";
const isEmpty = (cell: Cell): boolean => cell.content === "empty";

/** A row of the popup's list, an instance of the row's set at rest and not selected, its label exposed. */
function rowManifest(label: string, shownIn: (cell: Cell) => boolean): InstanceManifest {
  return {
    kind: "instance",
    key: `item-${label.toLowerCase()}`,
    of: COMBOBOX_ITEM_MANIFEST,
    cell: () => ({ selected: "off", state: "rest" }),
    properties: () => ({ text: { Label: label } }),
    shownIn,
    exposed: true,
  };
}

/**
 * The row's manifest, which the capture-backed build reads with `captures/combobox-item.json`:
 * `<Combobox.Item value>Apple</Combobox.Item>` in an open `Combobox.List`, selected or not, disabled
 * through its `disabled` prop. Base UI's `ItemIndicator` `<span>` follows the text while the row is
 * selected.
 */
export const COMBOBOX_ITEM_MANIFEST: SetManifest = {
  key: "combobox-item",
  name: "Combobox item",
  slot: "combobox-item",
  axes: [
    { name: "selected", values: ["off", "on"] },
    { name: "state", values: ["rest", "highlighted", "disabled"] },
  ],
  columnAxis: "state",
  label: {
    key: "label",
    name: "label",
    characters: COMBOBOX_ITEM_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: () => [],
  parts: [
    {
      key: "indicator",
      slot: undefined,
      place: "combobox-item/0",
      after: "label",
      shownIn: (cell) => cell.selected === "on",
      label: undefined,
      iconsFor: () => [MENU_CHECK],
    },
  ],
  swapProperties: [],
};

/**
 * The empty message's manifest, which the capture-backed build reads with
 * `captures/combobox-empty.json`: `<Combobox.Empty />` in an open popup whose input matches no row.
 */
export const COMBOBOX_EMPTY_MANIFEST: SetManifest = {
  key: "combobox-empty",
  name: "Combobox empty",
  slot: "combobox-empty",
  axes: [{ name: "content", values: ["empty"] }],
  columnAxis: "content",
  label: {
    key: "text",
    name: "text",
    characters: COMBOBOX_EMPTY_TEXT,
    textProperty: "Text",
    shownIn: always,
  },
  iconsFor: () => [],
  swapProperties: [],
};

/** A `Combobox.Group`, Base UI's classless `<div role="group">`, holding its caption and rows. */
function groupManifest({ value: label, items: rows }: (typeof COMBOBOX_GROUPS)[number]): PartManifest {
  return {
    key: `group-${label.toLowerCase()}`,
    slot: "combobox-group",
    shownIn: isGrouped,
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        kind: "instance",
        key: `label-${label.toLowerCase()}`,
        of: MENU_GROUP_LABEL_MANIFEST,
        slot: "combobox-label",
        cell: () => ({ kind: "plain" }),
        properties: () => ({ text: { Label: label } }),
        shownIn: isGrouped,
        exposed: true,
      },
      ...rows.map((row) => rowManifest(row, isGrouped)),
    ],
  };
}

/**
 * The popup's manifest, which the capture-backed build reads with `captures/combobox-popup.json`. Its
 * sample's anchor, the Input group, fills the 384px host the sample renders in.
 */
export const COMBOBOX_POPUP_MANIFEST: SetManifest = {
  key: "combobox-popup",
  name: "Combobox popup",
  slot: "combobox-content",
  axes: [{ name: "content", values: ["flat", "grouped", "empty"] }],
  columnAxis: "content",
  previewWidth: COMBOBOX_INPUT_GROUP_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "empty",
      of: COMBOBOX_EMPTY_MANIFEST,
      cell: () => ({ content: "empty" }),
      shownIn: isEmpty,
      exposed: true,
    },
    {
      key: "list",
      slot: "combobox-list",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: (() => {
        const [first, second] = COMBOBOX_GROUPS.map(groupManifest);
        const separator: InstanceManifest = {
          kind: "instance",
          key: "separator",
          of: MENU_SEPARATOR_MANIFEST,
          slot: "combobox-separator",
          cell: () => ({ size: "default" }),
          shownIn: isGrouped,
        };
        return [
          ...COMBOBOX_BASIC_ROWS.map((row) => rowManifest(row, isFlat)),
          ...(first === undefined || second === undefined ? [] : [first, separator, second]),
        ];
      })(),
    },
  ],
  swapProperties: [],
};

/**
 * The open Combobox's manifest, which the capture-backed build reads with
 * `captures/combobox-open.json`: the Input group and the popup it measures, and `Combobox.Content`'s
 * `sideOffset` as the docs' API reference gives it.
 */
export const COMBOBOX_OPEN_MANIFEST: SetManifest = {
  key: "combobox-open",
  name: "Combobox (open)",
  slot: "combobox-open",
  axes: [{ name: "placement", values: ["below"] }],
  columnAxis: "placement",
  previewWidth: COMBOBOX_INPUT_GROUP_WIDTH,
  union: ["input-group", "combobox-content"],
  sideOffset: 6,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "input",
      of: INPUT_GROUP_MANIFEST,
      cell: () => ({ form: "caret open", state: "rest" }),
      shownIn: always,
    },
    {
      kind: "instance",
      key: "popup",
      of: COMBOBOX_POPUP_MANIFEST,
      cell: () => ({ content: "flat" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
