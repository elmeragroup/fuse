/**
 * Select's open state, as three component sets on the Select page beside the trigger and the shared
 * menu parts: a row, the popup that holds the rows, and the trigger with the popup open below it.
 *
 * - `Select item` is a row, selected off and on, at rest, highlighted and disabled: 6 cells.
 *   `Select.Item` renders Base UI's `<div role="option" data-slot="select-item">` with the `item` slot
 *   of `selectContentVariants`: the shared menu row, `row-h` tall, inset by `row-px` and `row-py`,
 *   with room at its end for the Check. Its text sits in Base UI's `ItemText` `<div>`, which fills the
 *   row. Base UI mounts the indicator `<span>` only while the row is selected, so the Check shows
 *   there alone. The indicator is `absolute right-(--row-px)` in the room the row's end padding keeps,
 *   which the kit draws in flow after the text, the row then padding its end by `row-px`. A highlighted
 *   row has DOM focus, which `focus:` paints `accent`, its text `accent-foreground`. A disabled row
 *   dims to 50%; Base UI keeps it focusable and marks it `aria-disabled` and `data-disabled`. Each
 *   cell sits at rest in an ungrouped popup 144px wide, as the docs Basic demo's rows do, so it
 *   rounds with the popup's own corner and takes its `popover-foreground`.
 * - `Select popup` is the open popup, `content` flat or grouped: 2 cells, the docs Basic and Groups
 *   demos' rows as instances, a fixed sample with nothing selected. The popup is the shared surface:
 *   `bg-popover`, `shadow-md` and a 1px `foreground/10` ring, rounded `radius-lg`, padding nothing,
 *   as wide as its trigger and at least 144px, which is 144px in every demo. Base UI's listbox `<div>`
 *   holds the rows. A group pads its rows by `surface-pad-sm`, so they round with the synced inner
 *   corner `radius-inner/lg-pad-sm`. The separator between the groups spans the popup, which clips
 *   its negative side margins, and keeps 4px above and below it.
 * - `Select (open)` is the trigger with its popup open below it, at both trigger sizes: 2 cells. Base
 *   UI places the popup under the trigger, 4px below it, centered on it and as wide as it, at least
 *   144px (Q-M1), so the composite is a column of the trigger's instance and the popup's, centered.
 *   Both triggers are narrower than 144px, so the popup draws 144px wide, as alone. The popup aligns
 *   its selected row over the trigger only while Fuse's `alignItemWithTrigger` holds and the pointer
 *   opens it, which the kit does not draw. The column clips nothing, so the popup's shadow shows.
 */
import { selectContentVariants } from "@elmeragroup/fuse/recipe-catalog";

import type {
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  OuterDeclaration,
  PartDefinition,
} from "./component-spec";
import { DIV_BLOCK } from "./element-defaults";
import {
  MENU_CHECK,
  menuGroupPart,
  menuRowPart,
  menuSeparatorPart,
  SELECT_POPUP_ANCESTOR,
  SELECT_POPUP_FACTS,
  SELECT_POPUP_WIDTH,
} from "./menu-kit";
import { always } from "./popup-facts";
import { SELECT_TRIGGER } from "./select-trigger-kit";

const { content, item, itemText, itemIndicator, group } = selectContentVariants();

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
 * The trigger's width, which Base UI publishes on the popup as `--anchor-width` and the popup takes as
 * its own, at least 144px. Every trigger a docs demo shows is narrower, at both sizes and densities,
 * so the popup is its 144px minimum. The kit publishes that width as the anchor's, which gives the
 * popup the definite width a popup of rows that fill it needs, since Figma hugs such a column only to
 * its minimum (PM). The popup draws 144px wide alone and in the open composite alike.
 */
const ANCHOR_WIDTH: OuterDeclaration = {
  className: "Base UI's positioner, which publishes the trigger's width",
  property: "--anchor-width",
  value: `${SELECT_POPUP_WIDTH}px`,
};

/** Base UI's `ItemText` `<div>`, which holds the row's text and fills the row. */
const ITEM_TEXT: PartDefinition = {
  key: "text",
  slot: undefined,
  element: { tag: "div", attributes: {} },
  shownIn: always,
  classesFor: () => itemText(),
  label: {
    key: "label",
    name: "label",
    characters: SELECT_ITEM_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: () => [],
};

/** Base UI's `ItemIndicator` `<span>`, which it mounts only while the row is selected. */
const ITEM_INDICATOR: PartDefinition = {
  key: "indicator",
  slot: undefined,
  element: { tag: "span", attributes: { "aria-hidden": "true" } },
  shownIn: isSelected,
  classesFor: () => itemIndicator(),
  label: undefined,
  iconsFor: () => [MENU_CHECK],
};

/**
 * A row, as `<Select.Item value>Apple</Select.Item>` in an open, ungrouped `Select.Content`, selected
 * or not, disabled through its `disabled` prop.
 */
export const SELECT_ITEM: ComponentDefinition = {
  key: "select-item",
  name: "Select item",
  slot: "select-item",
  // Base UI's row is a `<div>` that keeps focus while disabled and marks it as it marks a span.
  rootKind: "base-ui-span",
  axes: [
    { name: "selected", values: ["off", "on"] },
    { name: "state", values: ["rest", "highlighted", "disabled"] },
  ],
  columnAxis: "state",
  classesFor: () => item(),
  previewWidth: SELECT_POPUP_WIDTH,
  ancestorsFor: () => [SELECT_POPUP_ANCESTOR],
  // Base UI moves DOM focus to the highlighted row.
  states: { highlighted: ["focus"] },
  facts: SELECT_POPUP_FACTS,
  omittedStates: new Set(),
  omittedCompositions: new Map([
    [
      "*",
      "`*:[span]:last:` lays out the row's last `<span>`, the indicator, as a flex row that centers its items, as the indicator's own classes already do, and its gap spaces nothing beside the one Check it holds",
    ],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [ITEM_TEXT, ITEM_INDICATOR],
  swapProperties: [],
};

/** A row of the popup, an instance of the row's set at rest and not selected, its label exposed. */
const rowOf = (label: string, shownIn: (cell: Cell) => boolean): InstanceDefinition =>
  menuRowPart(SELECT_ITEM, { selected: "off", state: "rest" }, label, shownIn);

const isFlat = (cell: Cell): boolean => cell.content === "flat";
const isGrouped = (cell: Cell): boolean => cell.content === "grouped";

/** A `Select.Group` holding its label and rows, each an instance. */
function groupOf({ label, rows }: (typeof SELECT_GROUPS)[number]): PartDefinition {
  return menuGroupPart({
    slot: "select-group",
    classes: group(),
    label,
    rows: rows.map((row) => rowOf(row, isGrouped)),
    shownIn: isGrouped,
  });
}

/**
 * The separator between the groups, an instance of the shared set. Select's `separator` slot is the
 * shared class plus `pointer-events-none`, which the composite passes.
 */
const GROUP_SEPARATOR: InstanceDefinition = menuSeparatorPart({
  classes: "pointer-events-none",
  shownIn: isGrouped,
});

/** Base UI's listbox `<div>`, which holds the rows and carries no class. */
const LIST: PartDefinition = {
  key: "list",
  slot: undefined,
  element: { tag: "div", attributes: { role: "listbox" } },
  shownIn: always,
  classesFor: () => "",
  elementDefaults: DIV_BLOCK,
  label: undefined,
  iconsFor: () => [],
  parts: (() => {
    const [first, second] = SELECT_GROUPS.map(groupOf);
    return [
      ...SELECT_BASIC_ROWS.map((row) => rowOf(row, isFlat)),
      ...(first === undefined || second === undefined ? [] : [first, GROUP_SEPARATOR, second]),
    ];
  })(),
};

/** The open popup, as `<Select.Content>` holding the docs Basic demo's rows or its Groups demo's groups. */
export const SELECT_POPUP: ComponentDefinition = {
  key: "select-popup",
  name: "Select popup",
  slot: "select-content",
  axes: [{ name: "content", values: ["flat", "grouped"] }],
  columnAxis: "content",
  classesFor: () => content(),
  inheritedFor: () => [ANCHOR_WIDTH],
  elementDefaults: DIV_BLOCK,
  states: {},
  facts: SELECT_POPUP_FACTS,
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [LIST],
  swapProperties: [],
};

/**
 * The open Select: the trigger at a size, its popup open, holding the docs Basic demo's placeholder,
 * and the popup below it holding the Basic demo's rows. The composite has no element of its own: the
 * column draws Base UI's placement, the popup 4px below the trigger and centered on it.
 */
export const SELECT_OPEN: ComponentDefinition = {
  key: "select-open",
  name: "Select (open)",
  slot: "select-open",
  axes: [
    { name: "placement", values: ["below"] },
    { name: "size", values: ["default", "sm"] },
  ],
  columnAxis: "size",
  classesFor: () => "flex flex-col items-center gap-1",
  inheritedFor: () => [ANCHOR_WIDTH],
  // The popup's shadow reaches past the column below and beside it.
  rootOverflow: "visible",
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "trigger",
      of: SELECT_TRIGGER,
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
      of: SELECT_POPUP,
      cell: () => ({ content: "flat" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
