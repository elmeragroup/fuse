/**
 * Command's rows and list, as component sets on a page of their own.
 *
 * - `Command item` is a result row, with no trailing part, a shortcut or a caret, at rest,
 *   highlighted and disabled: 9 cells. `Command.Item` renders Base UI's `<div role="option"
 *   data-slot="command-item">`, holding its own text. `Command.Shortcut` follows the text as a Kbd
 *   group, which the row draws as an instance of the `Kbd group` set, and `Command.PageTrigger` ends
 *   its row with a CaretRight. Base UI marks a highlighted row `data-highlighted`, and the input keeps
 *   DOM focus. A disabled row dims. The shortcut shows the `Kbd group` set's own caps.
 * - `Command list` is the docs Groups demo's `Command.List`, 1 cell: the list alone, since the demo
 *   renders the input beside it in the app's box. Each `Command.Group` holds the shared `Menu group
 *   label` and its rows, instances of the item set with a shortcut, whose caps show the demo's Alt and
 *   the row's letter as nested values (PN).
 *
 * The palette dialog, `Command.Content`, sits in `command-dialog-kit.ts`.
 */
import type { IconManifest, InstanceManifest, SetManifest } from "../capture/manifest";
import {
  COMMAND_GROUPS,
  COMMAND_ITEM_TEXT,
  COMMAND_LIST_MODIFIER,
  COMMAND_LIST_WIDTH,
  COMMAND_ROW_CELL_WIDTH,
} from "./command-text";
import type { Cell } from "./component-spec";
import { KBD_GROUP_MANIFEST } from "./kbd-kit";
import { menuGroupManifest, menuRowManifest } from "./menu-kit";
import { always } from "./popup-facts";

/** `Command.PageTrigger`'s CaretRight, fixed, so no swap property picks it. */
const CARET: IconManifest = {
  key: "caret",
  name: "CaretRight",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "CaretRight",
  swapProperty: undefined,
};

const isGrouped = (cell: Cell): boolean => cell.content === "grouped";

/**
 * `Command.Shortcut`, a Kbd group after the row's text, exposed so a designer retypes its caps, in a
 * row that is highlighted or not. Each face is its own instance; both keep the layer name
 * `kbd-group`, so Figma maps a designer's overrides across the variant switch.
 */
function shortcutManifest(highlighted: boolean): InstanceManifest {
  return {
    kind: "instance",
    key: highlighted ? "shortcut-highlighted" : "shortcut",
    of: KBD_GROUP_MANIFEST,
    cell: () => ({ keys: "2" }),
    slot: "command-shortcut",
    shownIn: (cell) => cell.trailing === "shortcut" && (cell.state === "highlighted") === highlighted,
    after: "label",
    exposed: true,
  };
}

/**
 * The row's manifest, which the capture-backed build reads with `captures/command-item.json`:
 * `<Command.Item>New customer</Command.Item>` in an open `Command.List`, with a `<Command.Shortcut>`
 * after its text, or as `<Command.PageTrigger>`, which renders the row with its own slot, disabled
 * through its `disabled` prop.
 */
export const COMMAND_ITEM_MANIFEST: SetManifest = {
  key: "command-item",
  name: "Command item",
  slot: "command-item",
  elementSlot: (cell) => (cell.trailing === "caret" ? "command-page-trigger" : "command-item"),
  axes: [
    { name: "trailing", values: ["none", "shortcut", "caret"] },
    { name: "state", values: ["rest", "highlighted", "disabled"] },
  ],
  columnAxis: "state",
  previewWidth: COMMAND_ROW_CELL_WIDTH,
  label: {
    key: "label",
    name: "label",
    characters: COMMAND_ITEM_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: (cell: Cell) => (cell.trailing === "caret" ? [CARET] : []),
  parts: [shortcutManifest(false), shortcutManifest(true)],
  swapProperties: [],
};

/**
 * The list's manifest, which the capture-backed build reads with `captures/command-list.json`: each
 * group's label and its rows, each row's shortcut showing Alt and its letter (PN).
 */
export const COMMAND_LIST_MANIFEST: SetManifest = {
  key: "command-list",
  name: "Command list",
  slot: "command-list",
  axes: [{ name: "content", values: ["grouped"] }],
  columnAxis: "content",
  previewWidth: COMMAND_LIST_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: COMMAND_GROUPS.map(({ value: label, items }) =>
    menuGroupManifest({
      slot: "command-group",
      labelSlot: "command-label",
      label,
      rows: items.map(({ label: row, key }) =>
        menuRowManifest(COMMAND_ITEM_MANIFEST, { trailing: "shortcut", state: "rest" }, row, isGrouped, {
          nested: [
            { path: ["shortcut", "modifier"], text: { Label: COMMAND_LIST_MODIFIER } },
            { path: ["shortcut", "key"], text: { Label: key } },
          ],
        })
      ),
      shownIn: isGrouped,
    })
  ),
  swapProperties: [],
};
