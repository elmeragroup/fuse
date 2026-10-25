/**
 * Command's rows and list, as component sets on a page of their own.
 *
 * - `Command item` is a result row, with no trailing part, a shortcut or a caret, at rest,
 *   highlighted and disabled: 9 cells. `Command.Item` renders Base UI's `<div role="option"
 *   data-slot="command-item">` with the `item` slot of `commandVariants`: the shared menu row, `row-h`
 *   tall, inset by `row-px` and `row-py`, holding its own text. `Command.Shortcut` follows the text as
 *   a Kbd group, which the row draws as an instance of the `Kbd group` set, and `Command.PageTrigger`
 *   ends its row with a CaretRight. Both take the `trailing` slot, whose `ms-auto` ends the row with
 *   them, so the text fills the room before them (CSS Flexbox 1 §8.1). Base UI marks a highlighted row
 *   `data-highlighted`, which paints it `accent`, its text and caret `accent-foreground`; the shortcut's
 *   caps keep their own muted face. A disabled row dims to 50%. Each cell sits in the list, which
 *   rounds it with the synced inner corner `radius-inner/xl-gap-sm`. The shortcut shows the `Kbd
 *   group` set's own caps.
 * - `Command list` is the docs Groups demo's `Command.List`, 1 cell: the list alone, since the demo
 *   renders the input beside it in the app's box, 576px wide, `max-w-xl`, padding its rows by
 *   `surface-gap-sm` and clipping past 320px, `max-h-80`. Each `Command.Group` holds the shared `Menu
 *   group label` and its rows, instances of the item set with a shortcut, whose caps show the demo's
 *   Alt and the row's letter as nested values (PN).
 *
 * The palette dialog, `Command.Content`, waits for a dialog surface.
 */
import { commandListShellClass, commandVariants } from "@elmeragroup/fuse/recipe-catalog";

import {
  COMMAND_GROUPS,
  COMMAND_ITEM_TEXT,
  COMMAND_LIST_MODIFIER,
  COMMAND_LIST_WIDTH,
  COMMAND_ROW_CELL_WIDTH,
} from "./command-text";
import type {
  AncestorDefinition,
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  OuterDeclaration,
  PartDefinition,
} from "./component-spec";
import { KBD_GROUP } from "./kbd-kit";
import { DIV_BLOCK, MENU_GROUP_LABEL } from "./menu-kit";

const { list, item, trailing } = commandVariants();

const always = (): boolean => true;
const never = (): boolean => false;

/** The list around a row, which publishes the row's inner corner. */
const LIST_ANCESTOR: AncestorDefinition = {
  slot: "command-list",
  classes: `${list()} ${commandListShellClass}`,
  undrawn: "the list's padding and height, which hold the rows",
};

/**
 * The palette's surface around the list, whose text color the rows inherit: `Command.Content`'s modal
 * face, or the app's box around an inline palette, as the docs Groups demo draws it. Both carry no
 * `data-slot` the rows sit in, and the kit draws neither: the dialog waits for a dialog surface.
 */
const SURFACE_COLOR: OuterDeclaration = {
  className: "the palette's surface, `text-popover-foreground`",
  property: "color",
  value: "var(--popover-foreground)",
};

/** `Command.PageTrigger`'s CaretRight, fixed, so no swap property picks it. */
const CARET: IconSlot = {
  key: "caret",
  name: "CaretRight",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "CaretRight",
  swapProperty: undefined,
  classes: trailing(),
};

/**
 * `Command.Shortcut`, a Kbd group after the row's text, exposed so a designer retypes its caps, in a
 * row that is highlighted or not. Instance facts read the inner cell, so each face is its own
 * instance; both keep the layer name `kbd-group`, so Figma maps a designer's overrides across the
 * variant switch.
 */
function shortcutOf(highlighted: boolean): InstanceDefinition {
  return {
    kind: "instance",
    key: highlighted ? "shortcut-highlighted" : "shortcut",
    of: KBD_GROUP,
    cell: () => ({ keys: "2" }),
    slot: "command-shortcut",
    classesFor: () => trailing(),
    // `in-data-highlighted:` reads the highlighted row around the shortcut.
    facts: new Map([["in-data-highlighted", () => highlighted]]),
    shownIn: (cell) => cell.trailing === "shortcut" && (cell.state === "highlighted") === highlighted,
    after: "label",
    exposed: true,
  };
}

/**
 * A row, as `<Command.Item>New customer</Command.Item>` in an open `Command.List`, with a
 * `<Command.Shortcut>` after its text, or as `<Command.PageTrigger>`, disabled through its `disabled`
 * prop.
 */
export const COMMAND_ITEM: ComponentDefinition = {
  key: "command-item",
  name: "Command item",
  slot: "command-item",
  // `Command.PageTrigger` renders the row with its own slot.
  element: { tag: "div", attributes: { role: "option" } },
  elementSlot: (cell) => (cell.trailing === "caret" ? "command-page-trigger" : "command-item"),
  // Base UI's row is a `<div>` that marks its disabled state as it marks a span's.
  rootKind: "base-ui-span",
  axes: [
    { name: "trailing", values: ["none", "shortcut", "caret"] },
    { name: "state", values: ["rest", "highlighted", "disabled"] },
  ],
  columnAxis: "state",
  classesFor: () => item(),
  previewWidth: COMMAND_ROW_CELL_WIDTH,
  ancestorsFor: () => [LIST_ANCESTOR],
  inheritedFor: () => [SURFACE_COLOR],
  // Base UI marks the highlighted row, and the input keeps DOM focus.
  states: { highlighted: ["data-highlighted", "in-data-highlighted"] },
  // The list holds the row, so it is not empty.
  facts: new Map([["data-empty", never]]),
  omittedStates: new Set(),
  label: {
    key: "label",
    name: "label",
    characters: COMMAND_ITEM_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: (cell: Cell) => (cell.trailing === "caret" ? [CARET] : []),
  parts: [shortcutOf(false), shortcutOf(true)],
  swapProperties: [],
};

const isGrouped = (cell: Cell): boolean => cell.content === "grouped";

/**
 * A row of the list, an instance of the row's set with its shortcut, at rest, its label exposed. Its
 * shortcut's caps show the demo's Alt and the row's letter as nested values (PN).
 */
function rowOf({ label, key }: (typeof COMMAND_GROUPS)[number]["items"][number]): InstanceDefinition {
  return {
    kind: "instance",
    key: `item-${label.toLowerCase().replaceAll(" ", "-")}`,
    of: COMMAND_ITEM,
    cell: () => ({ trailing: "shortcut", state: "rest" }),
    properties: () => ({
      text: { Label: label },
      nested: [
        { path: ["shortcut", "modifier"], text: { Label: COMMAND_LIST_MODIFIER } },
        { path: ["shortcut", "key"], text: { Label: key } },
      ],
    }),
    shownIn: isGrouped,
    exposed: true,
  };
}

/** A `Command.Group`, Base UI's classless `<div role="group">`, holding its label and rows. */
function groupOf({ value: label, items: rows }: (typeof COMMAND_GROUPS)[number]): PartDefinition {
  return {
    key: `group-${label.toLowerCase().replaceAll(" ", "-")}`,
    slot: "command-group",
    shownIn: isGrouped,
    classesFor: () => "",
    elementDefaults: DIV_BLOCK,
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        kind: "instance",
        key: `label-${label.toLowerCase().replaceAll(" ", "-")}`,
        of: MENU_GROUP_LABEL,
        // Command's label is the shared one, class for class.
        cell: () => ({ kind: "plain" }),
        slot: "command-label",
        properties: () => ({ text: { Label: label } }),
        shownIn: isGrouped,
        exposed: true,
      },
      ...rows.map(rowOf),
    ],
  };
}

/**
 * The list of the docs Groups demo, as `<Command.List>` in an inline palette, its groups and rows as
 * the demo writes them, each row's shortcut Alt and its letter.
 */
export const COMMAND_LIST: ComponentDefinition = {
  key: "command-list",
  name: "Command list",
  slot: "command-list",
  axes: [{ name: "content", values: ["grouped"] }],
  columnAxis: "content",
  classesFor: () => `${list()} ${commandListShellClass}`,
  previewWidth: COMMAND_LIST_WIDTH,
  inheritedFor: () => [SURFACE_COLOR],
  elementDefaults: DIV_BLOCK,
  states: {},
  facts: new Map([["data-empty", never]]),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: COMMAND_GROUPS.map(groupOf),
  swapProperties: [],
};
