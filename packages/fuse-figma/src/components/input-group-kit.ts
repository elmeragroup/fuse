/**
 * Input group, as one component set limited to the forms Combobox and Command render: four forms in
 * four states, 16 cells. The root is `InputGroup.Root`'s `<div data-slot="input-group">` at the
 * default field size. It holds the control, `<input data-slot="input-group-control">`, and one inline
 * addon.
 *
 * - `form=caret` is `Combobox.Input`: a trailing addon holding the caret trigger, an `Icon button`
 *   instance with CaretDown.
 * - `form=search` is `Command.Input`: a leading addon holding a MagnifyingGlass. The addon follows
 *   the control in the DOM and draws first.
 * - `form=clear` is `Combobox.Input` with `showClear` and no trigger: a trailing addon holding the
 *   clear button, an `Icon button` instance with X. Base UI shows it while the Combobox holds a
 *   selection, so it draws beside the placeholder, as the docs multi-chips demo's filter does.
 * - `form=caret open` is `Combobox.Input` while its popup is open, which the open Combobox holds.
 *   The CaretDown turns half a turn there. Figma turns no layer inside an instance (PT), so the
 *   caret instance swaps to CaretUp, the CaretDown's proven half-turn mirror. The matrix crosses
 *   every form with every state, so the form is drawn disabled too, though an open Combobox never is.
 * - The control takes the states, and the root reads them from it. Only an invalid cell renders the
 *   group in a Field.
 * - The text is one TEXT property, `Text`, that starts as a placeholder.
 * - Block addons, a textarea, a kbd, read-only and `aria-disabled` controls are left out:
 *   neither Combobox nor Command renders them.
 */
import type { IconManifest, InstanceManifest, SetManifest } from "../capture/manifest";
import { ICON_BUTTON_MANIFEST } from "./button-kit";
import type { Cell } from "./component-spec";
import { INPUT_GROUP_TEXT } from "./input-group-text";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";

/** The forms, Combobox's default input first, and its input while the popup is open last. */
const FORMS = ["caret", "search", "clear", "caret open"] as const;

/** Whether a cell shows Combobox's caret, closed or open. */
function showsCaret(cell: Cell): boolean {
  return cell.form === "caret" || cell.form === "caret open";
}

/** Whether a cell's addon trails the control, as Combobox's does. */
function trails(cell: Cell): boolean {
  return showsCaret(cell) || cell.form === "clear";
}

/** Command's search glyph, a bare `<svg>` in the leading addon, fixed, so no swap property picks it. */
const SEARCH_ICON: IconManifest = {
  key: "search",
  name: "Search",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "MagnifyingGlass",
  swapProperty: undefined,
};

/** The disabled Icon button state where the group is disabled, as Combobox disables its buttons too. */
function buttonCell(cell: Cell): Cell {
  return { variant: "ghost", size: "icon-sm", state: cell.state === "disabled" ? "disabled" : "rest" };
}

/**
 * Combobox's caret trigger in the trailing addon: `InputGroup.Button` rendering `Combobox.Trigger`,
 * an `Icon button` instance with CaretDown. Inside an invalid Field, Base UI marks the trigger
 * `aria-invalid` and `data-invalid` too, so the invalid cells hold their own instance. The open
 * form's caret has its own instance too.
 *
 * @param invalid - Whether this is the invalid cells' instance.
 * @param open - Whether this is the open form's instance.
 * @returns The instance part.
 */
function caretManifest(invalid: boolean, open: boolean): InstanceManifest {
  return {
    kind: "instance",
    key: ["caret", ...(open ? ["open"] : []), ...(invalid ? ["invalid"] : [])].join("-"),
    of: ICON_BUTTON_MANIFEST,
    cell: buttonCell,
    slot: "input-group-button",
    properties: () => ({ swap: { Icon: "CaretDown" } }),
    shownIn: (cell) =>
      cell.form === (open ? "caret open" : "caret") && (cell.state === "invalid") === invalid,
  };
}

/**
 * The Input group's manifest, which the capture-backed build reads with `captures/input-group.json`,
 * as `<Combobox.Input>`, `<Combobox.Input showClear showTrigger={false}>` or `<Command.Input>`
 * renders it, disabled or inside an invalid `Field.Root`.
 */
export const INPUT_GROUP_MANIFEST: SetManifest = {
  key: "input-group",
  name: "Input group",
  slot: "input-group",
  statePart: "input-group-control",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [
    { name: "form", values: FORMS },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "control",
      slot: "input-group-control",
      shownIn: always,
      label: {
        key: "text",
        name: "text",
        characters: INPUT_GROUP_TEXT,
        textProperty: "Text",
        shownIn: always,
        textAttribute: () => "placeholder",
      },
      iconsFor: () => [],
    },
    {
      key: "addon-start",
      slot: "input-group-addon",
      shownIn: (cell) => cell.form === "search",
      label: undefined,
      iconsFor: () => [SEARCH_ICON],
    },
    {
      key: "addon-end",
      slot: "input-group-addon",
      shownIn: trails,
      label: undefined,
      iconsFor: () => [],
      parts: [
        caretManifest(false, false),
        caretManifest(true, false),
        caretManifest(false, true),
        caretManifest(true, true),
        {
          // Combobox's clear button: `Combobox.Clear` rendering `InputGroup.Button`.
          kind: "instance",
          key: "clear",
          of: ICON_BUTTON_MANIFEST,
          cell: buttonCell,
          slot: "combobox-clear",
          properties: () => ({ swap: { Icon: "X" } }),
          shownIn: (cell) => cell.form === "clear",
        },
      ],
    },
  ],
  swapProperties: [],
};
