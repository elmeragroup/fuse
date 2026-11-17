/**
 * Command dialog, as two component sets on the Command page: the palette the docs Dialog demo opens,
 * and that palette open over the scrim.
 *
 * - `Command palette` is `Command.Content`'s Dialog popup, `<div role="dialog"
 *   data-slot="command-content">`, 1 cell. It is fixed in its viewport (`COMMAND_DIALOG_VIEWPORT`).
 *   It holds:
 *   - the input, `Command.Input`, an `Input group` instance in its search form;
 *   - the empty message, `Command.Empty`, which holds nothing while rows match and so draws no layer;
 *   - the list, `Command.List`, the demo's six commands as `Command item` instances at rest. Base UI
 *     highlights the first on open, and the compare page clears every highlight a client slot shows,
 *     so a cell draws one only where the page forces it, as the `Command item` set's highlighted cell
 *     does;
 *   - the footer, `Command.Footer`, three hints, each `Kbd` instances and its label: ↑ ↓ Navigate,
 *     ↵ Run, Esc Close.
 * - `Command dialog (open)` is the palette over the scrim, `Dialog.Backdrop`'s overlay. Base UI fixes
 *   the palette `max(1rem, 12dvh)` below the viewport's top and centres it across.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import {
  COMMAND_DIALOG_COMMANDS,
  COMMAND_DIALOG_EMPTY_TEXT,
  COMMAND_DIALOG_HINTS,
  COMMAND_DIALOG_VIEWPORT,
} from "./command-dialog-text";
import { COMMAND_ITEM_MANIFEST } from "./command-kit";
import { INPUT_GROUP_MANIFEST } from "./input-group-kit";
import { KBD_MANIFEST } from "./kbd-kit";
import { always, never } from "./popup-facts";

/** One footer hint: its label, and its key caps, `Kbd` instances. */
function hintManifest(entry: (typeof COMMAND_DIALOG_HINTS)[number]): PartManifest {
  return {
    key: `hint-${entry.key}`,
    slot: "command-hint",
    shownIn: always,
    label: { key: "label", name: "label", characters: entry.label, textProperty: undefined, shownIn: always },
    iconsFor: () => [],
    parts: entry.keys.map((key, index): InstanceManifest => ({
      kind: "instance",
      key: `key-${String(index + 1)}`,
      of: KBD_MANIFEST,
      cell: () => ({ content: "text" }),
      properties: () => ({ text: { Label: key } }),
      shownIn: always,
      exposed: true,
    })),
  };
}

/**
 * The palette's manifest, which the capture-backed build reads with `captures/command-palette.json`:
 * `<Command.Content>` in the docs Dialog demo, fixed in its viewport. `Command.Empty` holds its text
 * only while no row matches, so the label never shows.
 */
export const COMMAND_PALETTE_MANIFEST: SetManifest = {
  key: "command-palette",
  name: "Command palette",
  slot: "command-content",
  axes: [{ name: "content", values: ["commands"] }],
  columnAxis: "content",
  viewport: COMMAND_DIALOG_VIEWPORT,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "input",
      of: INPUT_GROUP_MANIFEST,
      slot: "command-input",
      cell: () => ({ form: "search", state: "rest" }),
      shownIn: always,
      exposed: true,
    },
    {
      key: "empty",
      slot: "command-empty",
      shownIn: always,
      label: {
        key: "text",
        name: "text",
        characters: COMMAND_DIALOG_EMPTY_TEXT,
        textProperty: undefined,
        shownIn: never,
      },
      iconsFor: () => [],
    },
    {
      key: "list",
      slot: "command-list",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: COMMAND_DIALOG_COMMANDS.map((label, index): InstanceManifest => ({
        kind: "instance",
        key: `item-${String(index + 1)}`,
        of: COMMAND_ITEM_MANIFEST,
        cell: () => ({ trailing: "none", state: "rest" }),
        properties: () => ({ text: { Label: label } }),
        shownIn: always,
        exposed: true,
      })),
    },
    {
      key: "footer",
      slot: "command-footer",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: COMMAND_DIALOG_HINTS.map(hintManifest),
    },
  ],
  swapProperties: [],
};

/**
 * The open Command dialog's manifest, which the capture-backed build reads with
 * `captures/command-dialog-open.json`: the Backdrop and the palette over it, in the viewport the
 * palette is fixed in.
 */
export const COMMAND_DIALOG_OPEN_MANIFEST: SetManifest = {
  key: "command-dialog-open",
  name: "Command dialog (open)",
  slot: "command-dialog-open",
  axes: [{ name: "placement", values: ["top"] }],
  columnAxis: "placement",
  viewport: COMMAND_DIALOG_VIEWPORT,
  union: ["dialog-overlay", "command-content"],
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "palette",
      of: COMMAND_PALETTE_MANIFEST,
      cell: () => ({ content: "commands" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
