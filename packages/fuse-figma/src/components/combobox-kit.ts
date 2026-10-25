/**
 * Combobox's open state, as component sets on a page of their own: a row, the empty state, the popup
 * that holds them, and the input with the popup open below it. The rows share `Menu group label` and
 * `Menu separator` with the other menu families.
 *
 * - `Combobox item` is a row, selected off and on, at rest, highlighted and disabled: 6 cells.
 *   `Combobox.Item` renders Base UI's `<div role="option" data-slot="combobox-item">` with the `item`
 *   slot of `comboboxVariants`: the shared menu row, `row-h` tall, inset by `row-px` and `row-py`, with
 *   room at its end for the Check. Its text is the row's own, and Base UI mounts the indicator `<span>`
 *   after it only while the row is selected. The indicator is `absolute right-(--row-px)` in the room
 *   the row's end padding keeps, which the kit draws in flow after the text, the row then padding its
 *   end by `row-px`. Base UI marks a highlighted row `data-highlighted`, which paints it `accent`, its
 *   text and Check `accent-foreground`. A disabled row dims to 50%. Each cell sits in the popup's list,
 *   which pads it by `surface-pad-sm` and rounds it with the synced inner corner
 *   `radius-inner/md-pad-sm`.
 * - `Combobox empty` is the popup's message while no row matches the input: `No results.`, centered,
 *   in `muted-foreground`, padded as a row, 1 cell. Fuse hides it until Base UI marks the popup
 *   `data-empty`.
 * - `Combobox popup` is the open popup, `content` flat, grouped and empty: 3 cells, the docs Basic and
 *   Groups demos' rows as instances, a fixed sample with nothing selected, and the empty message with
 *   no rows. The popup is the shared surface: `bg-popover`, `shadow-md` and a 1px `foreground/10` ring,
 *   rounded `radius-md`, clipping, padding nothing, as wide as its anchor plus 28px. Its list pads the
 *   rows by `surface-pad-sm` and scrolls past 252px, which the kit draws as a list that clips at that
 *   height. A separator between the groups cancels the list's padding across.
 * - `Combobox (open)` is the Input group of `Combobox.Input` while its popup is open, and the popup
 *   below it holding the Basic demo's rows, 1 cell. The input is the Input group set's
 *   `form=caret open`, whose caret draws the open trigger turned half a turn as CaretUp. Base UI places
 *   the popup 6px below the input, aligned to its start, and as wide as the input plus 28px, so the
 *   composite is a column as wide as the input, holding the input's instance and the popup's, which
 *   reaches 28px past the column's end. The column clips nothing, so the popup and its shadow show.
 *
 * The anchor is the Input group set's preview width, 384px, so every popup is 412px wide and every row
 * 404px.
 */
import { comboboxVariants } from "@elmeragroup/fuse/recipe-catalog";

import {
  COMBOBOX_ANCHOR_WIDTH,
  COMBOBOX_BASIC_ROWS,
  COMBOBOX_EMPTY_TEXT,
  COMBOBOX_GROUPS,
  COMBOBOX_ITEM_TEXT,
} from "./combobox-text";
import type {
  AncestorDefinition,
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  OuterDeclaration,
  PartDefinition,
} from "./component-spec";
import { INPUT_GROUP } from "./input-group-kit";
import { DIV_BLOCK, MENU_GROUP_LABEL, MENU_SEPARATOR } from "./menu-kit";

const { content, list, item, itemIndicator, empty } = comboboxVariants();

const always = (): boolean => true;
const never = (): boolean => false;

/** The popup's width, its `min-w-[calc(var(--anchor-width)+--spacing(7))]`: the anchor's plus 28px. */
const COMBOBOX_POPUP_WIDTH = COMBOBOX_ANCHOR_WIDTH + 28;

/** The width the list gives a row: the popup's, less `surface-pad-sm`, 4px at both densities, on each side. */
const COMBOBOX_ROW_WIDTH = COMBOBOX_POPUP_WIDTH - 2 * 4;

/**
 * The input's width, which Base UI's positioner publishes as `--anchor-width` and the popup's width
 * reads. The kit publishes the Input group set's width, which gives the popup a definite width.
 */
const ANCHOR_WIDTH: OuterDeclaration = {
  className: "Base UI's positioner, which publishes the input's width",
  property: "--anchor-width",
  value: `${COMBOBOX_ANCHOR_WIDTH}px`,
};

/**
 * The variants Base UI stamps on an open Combobox popup below its input, as the kit draws it:
 * `data-open`, the side it places the popup on, Fuse's `data-external-anchor="false"`, since the input
 * is the anchor, and `data-empty` where no row matches. No popup the sets draw holds an Input group.
 */
function popupFacts(isEmpty: (cell: Cell) => boolean): ReadonlyMap<string, (cell: Cell) => boolean> {
  return new Map<string, (cell: Cell) => boolean>([
    ["data-open", always],
    ["data-closed", never],
    ["data-[side=bottom]", always],
    ...["top", "left", "right", "inline-start", "inline-end"].map(
      (side) => [`data-[side=${side}]`, never] as const
    ),
    ["data-[external-anchor=true]", never],
    ["has-[>[data-slot=input-group]]", never],
    ["data-empty", isEmpty],
    ["group-data-empty/combobox-content", isEmpty],
  ]);
}

/** Why the popup's search-field classes draw nothing: no popup the sets draw holds an Input group. */
const NO_SEARCH_FIELD: readonly [string, string] = [
  "*",
  "`*:data-[slot=input-group]:` restyles an Input group the popup holds as its own child, as the docs Input group anchor demo's search field, which no popup the kit draws holds",
];

/** The open popup around a row, which the row inherits its text color from. */
const POPUP_ANCESTOR: AncestorDefinition = {
  slot: "combobox-content",
  classes: content(),
  undrawn: "the popup's surface, width and motion, which the Combobox popup set draws",
};

/** The popup's list around a row, which pads the rows and publishes their inner corner. */
const LIST_ANCESTOR: AncestorDefinition = {
  slot: "combobox-list",
  classes: list(),
  undrawn: "the list's padding and height, which the Combobox popup set draws around its rows",
};

/** The Check the indicator holds, fixed, so no swap property picks it. */
const CHECK: IconSlot = {
  key: "check",
  name: "Check",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "Check",
  swapProperty: undefined,
  classes: "pointer-events-none",
};

/** Base UI's `ItemIndicator`, rendered as a `<span>`, which it mounts only while the row is selected. */
const ITEM_INDICATOR: PartDefinition = {
  key: "indicator",
  slot: undefined,
  element: { tag: "span", attributes: {} },
  after: "label",
  shownIn: (cell) => cell.selected === "on",
  classesFor: () => itemIndicator(),
  label: undefined,
  iconsFor: () => [CHECK],
};

/**
 * A row, as `<Combobox.Item value>Apple</Combobox.Item>` in an open `Combobox.List`, selected or not,
 * disabled through its `disabled` prop.
 */
export const COMBOBOX_ITEM: ComponentDefinition = {
  key: "combobox-item",
  name: "Combobox item",
  slot: "combobox-item",
  // Base UI's row is a `<div>` that marks its disabled state as it marks a span's.
  rootKind: "base-ui-span",
  axes: [
    { name: "selected", values: ["off", "on"] },
    { name: "state", values: ["rest", "highlighted", "disabled"] },
  ],
  columnAxis: "state",
  classesFor: () => item(),
  previewWidth: COMBOBOX_ROW_WIDTH,
  ancestorsFor: () => [POPUP_ANCESTOR, LIST_ANCESTOR],
  inheritedFor: () => [ANCHOR_WIDTH],
  // Base UI marks the highlighted row, and the input keeps DOM focus.
  states: { highlighted: ["data-highlighted"] },
  facts: popupFacts(never),
  omittedStates: new Set(),
  omittedCompositions: new Map([NO_SEARCH_FIELD]),
  label: {
    key: "label",
    name: "label",
    characters: COMBOBOX_ITEM_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: () => [],
  parts: [ITEM_INDICATOR],
  swapProperties: [],
};

/** The empty message, as `<Combobox.Empty />` in an open popup whose input matches no row. */
export const COMBOBOX_EMPTY: ComponentDefinition = {
  key: "combobox-empty",
  name: "Combobox empty",
  slot: "combobox-empty",
  axes: [{ name: "content", values: ["empty"] }],
  columnAxis: "content",
  classesFor: () => empty(),
  previewWidth: COMBOBOX_POPUP_WIDTH,
  ancestorsFor: () => [POPUP_ANCESTOR],
  inheritedFor: () => [ANCHOR_WIDTH],
  states: {},
  facts: popupFacts(always),
  omittedStates: new Set(),
  omittedCompositions: new Map([NO_SEARCH_FIELD]),
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

const isFlat = (cell: Cell): boolean => cell.content === "flat";
const isGrouped = (cell: Cell): boolean => cell.content === "grouped";
const isEmpty = (cell: Cell): boolean => cell.content === "empty";

/** A row of the popup, an instance of the row's set at rest and not selected, its label exposed. */
function rowOf(label: string, shownIn: (cell: Cell) => boolean): InstanceDefinition {
  return {
    kind: "instance",
    key: `item-${label.toLowerCase()}`,
    of: COMBOBOX_ITEM,
    cell: () => ({ selected: "off", state: "rest" }),
    properties: () => ({ text: { Label: label } }),
    shownIn,
    exposed: true,
  };
}

/** A `Combobox.Group`, Base UI's classless `<div role="group">`, holding its label and rows. */
function groupOf({ value: label, items: rows }: (typeof COMBOBOX_GROUPS)[number]): PartDefinition {
  return {
    key: `group-${label.toLowerCase()}`,
    slot: "combobox-group",
    shownIn: isGrouped,
    classesFor: () => "",
    elementDefaults: DIV_BLOCK,
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        kind: "instance",
        key: `label-${label.toLowerCase()}`,
        of: MENU_GROUP_LABEL,
        // Combobox's label is the shared one, as Select's is.
        cell: () => ({ kind: "plain" }),
        slot: "combobox-label",
        properties: () => ({ text: { Label: label } }),
        shownIn: isGrouped,
        exposed: true,
      },
      ...rows.map((row) => rowOf(row, isGrouped)),
    ],
  };
}

/** The separator between the groups, an instance of the shared set, with Combobox's own slot. */
const GROUP_SEPARATOR: InstanceDefinition = {
  kind: "instance",
  key: "separator",
  of: MENU_SEPARATOR,
  cell: () => ({ size: "default" }),
  slot: "combobox-separator",
  shownIn: isGrouped,
};

/** `Combobox.List`, which pads the rows, publishes their corner and scrolls past 252px. */
const LIST: PartDefinition = {
  key: "list",
  slot: "combobox-list",
  shownIn: always,
  classesFor: () => list(),
  elementDefaults: DIV_BLOCK,
  label: undefined,
  iconsFor: () => [],
  parts: (() => {
    const [first, second] = COMBOBOX_GROUPS.map(groupOf);
    return [
      ...COMBOBOX_BASIC_ROWS.map((row) => rowOf(row, isFlat)),
      ...(first === undefined || second === undefined ? [] : [first, GROUP_SEPARATOR, second]),
    ];
  })(),
};

/** The empty message, which the popup holds before its list, shown where no row matches. */
const EMPTY: InstanceDefinition = {
  kind: "instance",
  key: "empty",
  of: COMBOBOX_EMPTY,
  cell: () => ({ content: "empty" }),
  shownIn: isEmpty,
  exposed: true,
};

/** The open popup, as `<Combobox.Content>` holding the docs Basic demo's rows, its Groups demo's groups, or none. */
export const COMBOBOX_POPUP: ComponentDefinition = {
  key: "combobox-popup",
  name: "Combobox popup",
  slot: "combobox-content",
  axes: [{ name: "content", values: ["flat", "grouped", "empty"] }],
  columnAxis: "content",
  classesFor: () => content(),
  inheritedFor: () => [ANCHOR_WIDTH],
  elementDefaults: DIV_BLOCK,
  states: {},
  facts: popupFacts(isEmpty),
  omittedStates: new Set(),
  omittedCompositions: new Map([NO_SEARCH_FIELD]),
  label: undefined,
  iconsFor: () => [],
  parts: [EMPTY, LIST],
  // `Combobox.Empty` stays in the markup while rows match, hidden, and draws nothing.
  undrawnChildren: (cell) => (isEmpty(cell) ? 0 : 1),
  swapProperties: [],
};

/**
 * The open Combobox: `Combobox.Input`'s Input group, its popup open, and the popup below it holding
 * the Basic demo's rows. The composite has no element of its own: the column draws Base UI's
 * placement, the popup 6px below the input, aligned to its start, and reaching 28px past the column's
 * end.
 */
export const COMBOBOX_OPEN: ComponentDefinition = {
  key: "combobox-open",
  name: "Combobox (open)",
  slot: "combobox-open",
  axes: [{ name: "placement", values: ["below"] }],
  columnAxis: "placement",
  classesFor: () => "flex flex-col gap-1.5",
  previewWidth: COMBOBOX_ANCHOR_WIDTH,
  inheritedFor: () => [ANCHOR_WIDTH],
  // The popup reaches 28px past the column's end, and its shadow past the column below and beside it.
  rootOverflow: "visible",
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "input",
      of: INPUT_GROUP,
      cell: () => ({ form: "caret open", state: "rest" }),
      // `Combobox.Input` passes `w-auto`, which the column stretches to its width.
      classesFor: () => "w-auto",
      shownIn: always,
    },
    {
      kind: "instance",
      key: "popup",
      of: COMBOBOX_POPUP,
      cell: () => ({ content: "flat" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
