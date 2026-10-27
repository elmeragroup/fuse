/**
 * Command dialog, as two component sets on the Command page: the palette the docs Dialog demo opens,
 * and that palette open over the scrim.
 *
 * - `Command palette` is `Command.Content`'s Dialog popup, `<div role="dialog"
 *   data-slot="command-content">` with the modal popup face, the palette shell and the `content` slot
 *   of `commandVariants`, 1 cell. It is fixed in its viewport (`COMMAND_DIALOG_VIEWPORT`),
 *   `w-[calc(100%-2rem)]` up to `max-w-xl`, 576px, capped at `100dvh` less twice its `12dvh` top,
 *   380px, on the `popover` fill with the modal edge, rounded `radius-xl`, a column that clips. It holds:
 *   - the input, `Command.Input`, an `Input group` instance in its search form with the palette's
 *     `input` classes, the small surface gap in from the edges. The open palette marks its control
 *     `data-popup-open` and `data-pressed`, which the Input group set renders only in its open caret
 *     form, so the instance stamps them (`stamps`);
 *   - the empty message, `Command.Empty`, which holds nothing while rows match and so draws no layer;
 *   - the list, `Command.List`, the demo's six commands as `Command item` instances at rest. Base UI
 *     highlights the first on open, and the compare page clears every highlight a client slot shows,
 *     so a cell draws one only where the page forces it, as the `Command item` set's highlighted cell
 *     does;
 *   - the footer, `Command.Footer`, three hints, each `Kbd` instances and its label: ↑ ↓ Navigate,
 *     ↵ Run, Esc Close.
 * - `Command dialog (open)` is the palette over the scrim, `Dialog.Backdrop`'s `fixed inset-0`
 *   overlay, `black/10` with a background blur. Base UI fixes the palette `max(1rem, 12dvh)` below the
 *   viewport's top, 60px, and centres it across, so the composite is the scrim, a column that pads its
 *   top by that length and centres the palette's instance across.
 */
import {
  cn,
  commandContentShellClass,
  commandListShellClass,
  commandVariants,
  dialogVariants,
  overlayModalPopupClass,
} from "@elmeragroup/fuse/recipe-catalog";

import {
  COMMAND_DIALOG_COMMANDS,
  COMMAND_DIALOG_EMPTY_TEXT,
  COMMAND_DIALOG_HINTS,
  COMMAND_DIALOG_TOP,
  COMMAND_DIALOG_VIEWPORT,
} from "./command-dialog-text";
import { COMMAND_ITEM } from "./command-kit";
import type { ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { DIV_BLOCK } from "./element-defaults";
import { INPUT_GROUP } from "./input-group-kit";
import { KBD } from "./kbd-kit";
import { always, never } from "./popup-facts";

const { content, input, empty, list, footer, hint } = commandVariants();

/** The facts the open palette's control carries, which the Input group set renders only in its open caret form. */
const OPEN_CONTROL: ReadonlySet<string> = new Set(["data-popup-open", "data-pressed"]);

/**
 * The input, `Command.Input`, an Input group in its search form, its control marked as an open
 * combobox: Base UI marks it `data-popup-open` and `data-pressed` while the palette is open. No class
 * of the search form reads them, so the instance draws the set's search cell as it is.
 */
const INPUT: InstanceDefinition = {
  kind: "instance",
  key: "input",
  of: INPUT_GROUP,
  slot: "command-input",
  cell: () => ({ form: "search", state: "rest" }),
  classesFor: () => input(),
  facts: new Map([
    ["data-popup-open", always],
    ["data-pressed", always],
  ]),
  stamps: OPEN_CONTROL,
  shownIn: always,
  exposed: true,
};

/** The empty message, which holds its text only while no row matches, so it draws no layer here. */
const EMPTY: PartDefinition = {
  key: "empty",
  slot: "command-empty",
  shownIn: always,
  classesFor: () => empty(),
  facts: new Map([["empty", always]]),
  elementDefaults: DIV_BLOCK,
  label: {
    key: "text",
    name: "text",
    characters: COMMAND_DIALOG_EMPTY_TEXT,
    textProperty: undefined,
    shownIn: never,
  },
  iconsFor: () => [],
};

/** A command row of the list, at rest. */
function row(label: string, index: number): InstanceDefinition {
  return {
    kind: "instance",
    key: `item-${String(index + 1)}`,
    of: COMMAND_ITEM,
    cell: () => ({ trailing: "none", state: "rest" }),
    properties: () => ({ text: { Label: label } }),
    shownIn: always,
    exposed: true,
  };
}

/** The list, the demo's commands. */
const LIST: PartDefinition = {
  key: "list",
  slot: "command-list",
  shownIn: always,
  classesFor: () => cn(list(), commandListShellClass),
  elementDefaults: DIV_BLOCK,
  label: undefined,
  iconsFor: () => [],
  parts: COMMAND_DIALOG_COMMANDS.map(row),
};

/** One footer hint: its key caps, `Kbd` instances, and its label, a `<span>` after them. */
function hintOf(entry: (typeof COMMAND_DIALOG_HINTS)[number]): PartDefinition {
  return {
    key: `hint-${entry.key}`,
    slot: "command-hint",
    shownIn: always,
    classesFor: () => hint(),
    label: {
      key: "label",
      name: "label",
      characters: entry.label,
      textProperty: undefined,
      shownIn: always,
      textElement: { tag: "span", attributes: {} },
    },
    iconsFor: () => [],
    parts: entry.keys.map((key, index): InstanceDefinition => ({
      kind: "instance",
      key: `key-${String(index + 1)}`,
      of: KBD,
      cell: () => ({ content: "text" }),
      properties: () => ({ text: { Label: key } }),
      shownIn: always,
      exposed: true,
    })),
  };
}

/** The footer of hints. */
const FOOTER: PartDefinition = {
  key: "footer",
  slot: "command-footer",
  shownIn: always,
  classesFor: () => footer(),
  label: undefined,
  iconsFor: () => [],
  parts: COMMAND_DIALOG_HINTS.map(hintOf),
  fitsOneLine:
    "Chromium measured the footer 37px tall dense and 45px comfortable, one line of hints, its three hints set from 16px and 24px in the 576px palette",
};

/** The open palette, as `<Command.Content>` in the docs Dialog demo. */
export const COMMAND_PALETTE: ComponentDefinition = {
  key: "command-palette",
  name: "Command palette",
  slot: "command-content",
  axes: [{ name: "content", values: ["commands"] }],
  columnAxis: "content",
  classesFor: () => cn(overlayModalPopupClass, commandContentShellClass, content()),
  // Its width, top and height cap read the viewport it is fixed in.
  viewport: COMMAND_DIALOG_VIEWPORT,
  underMaxHeight: "Chromium measured the palette 289px tall dense and 341px comfortable, under its 380px cap",
  states: {},
  facts: new Map([
    ["data-open", always],
    ["data-closed", never],
    // Rows match, so Base UI marks neither the list nor the palette empty.
    ["data-empty", never],
  ]),
  // The palette takes focus only while a keyboard user lands on it, and the kit draws it at rest.
  omittedStates: new Set(["focus-visible"]),
  label: undefined,
  iconsFor: () => [],
  parts: [INPUT, EMPTY, LIST, FOOTER],
  swapProperties: [],
};

/**
 * The open Command dialog: the palette over the scrim. The composite is the scrim, fixed over the
 * viewport, a column that pads its top by the palette's `max(1rem, 12dvh)`, 60px, and centres the
 * palette's instance across, where Base UI's fixed placement puts it.
 */
export const COMMAND_DIALOG_OPEN: ComponentDefinition = {
  key: "command-dialog-open",
  name: "Command dialog (open)",
  slot: "command-dialog-open",
  axes: [{ name: "placement", values: ["top"] }],
  columnAxis: "placement",
  classesFor: () =>
    cn(dialogVariants().overlay(), `flex flex-col items-center pt-[${String(COMMAND_DIALOG_TOP)}px]`),
  viewport: COMMAND_DIALOG_VIEWPORT,
  states: {},
  facts: new Map([
    ["data-open", always],
    ["data-closed", never],
  ]),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "palette",
      of: COMMAND_PALETTE,
      cell: () => ({ content: "commands" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
