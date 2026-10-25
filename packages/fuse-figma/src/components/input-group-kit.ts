/**
 * Input group, as one component set limited to the forms Combobox and Command render: four forms in
 * four states, 16 cells. The root is `InputGroup.Root`'s `<div data-slot="input-group">` with
 * `inputGroupRootClass`. It holds the control, `<input data-slot="input-group-control">`, and one
 * inline addon.
 *
 * - `form=caret` is `Combobox.Input`: a trailing addon holding the caret trigger, an `Icon button`
 *   instance with CaretDown.
 * - `form=search` is `Command.Input`: a leading addon holding a MagnifyingGlass. The addon follows
 *   the control in the DOM, and its `order-first` draws it first.
 * - `form=clear` is `Combobox.Input` with `showClear` and no trigger: a trailing addon holding the
 *   clear button, an `Icon button` instance with X. Base UI shows it while the Combobox holds a
 *   selection, so it draws beside the placeholder, as the docs multi-chips demo's filter does.
 * - `form=caret open` is `Combobox.Input` while its popup is open, which the open Combobox holds.
 *   Base UI marks the caret trigger `data-popup-open`, `aria-expanded` and `data-pressed`, and the
 *   CaretDown's `in-data-popup-open:rotate-180` turns it half a turn. Figma turns no layer inside an
 *   instance (PT), so the caret instance swaps to CaretUp, the CaretDown's proven half-turn mirror.
 *   The matrix crosses every form with every state, so the form is drawn disabled too, though an open
 *   Combobox never is.
 * - The box draws the field box: the field corner `radius-field-box`, a 1px `input` border, a `card`
 *   fill and `shadow-xs`, at the md control height. The root takes its states from its control, a
 *   direct child, through `has-[>[data-focus-ring-control]…]:`: focus rings it, disabled dims it to
 *   50% on the `input/50` fill, and invalid draws the `error` border and ring of a control inside an
 *   invalid Field.
 * - The text is one TEXT property, `Text`, that starts as a placeholder in `muted-foreground`.
 * - Block addons, a textarea, a kbd, read-only and `aria-disabled` controls are left out:
 *   neither Combobox nor Command renders them.
 */
import {
  cn,
  comboboxVariants,
  inputGroupAddonVariants,
  inputGroupButtonVariants,
  inputGroupInputControlClass,
  inputGroupRootClass,
  inputClass,
} from "@elmeragroup/fuse/recipe-catalog";

import { ICON_BUTTON } from "./button-kit";
import type {
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import { FIELD_BOX_PREVIEW_WIDTH, FIELD_ROOT, FIELD_ROOT_SR_ONLY, FIELD_ROOT_STRETCH } from "./field-box-kit";
import { INPUT_GROUP_TEXT } from "./input-group-text";

/** The forms, Combobox's default input first, and its input while the popup is open last. */
const FORMS = ["caret", "search", "clear", "caret open"] as const;

const { trigger, inputTrigger, caret: caretGlyph } = comboboxVariants();

const always = (): boolean => true;
const never = (): boolean => false;

/** Whether a cell shows Combobox's caret, closed or open. */
function showsCaret(cell: Cell): boolean {
  return cell.form === "caret" || cell.form === "caret open";
}

/** Whether a cell's addon trails the control, as Combobox's does. */
function trails(cell: Cell): boolean {
  return showsCaret(cell) || cell.form === "clear";
}

/** The control, a plain `<input>` with Input's look, stripped of the chrome the root owns. */
const CONTROL: PartDefinition = {
  key: "control",
  slot: "input-group-control",
  // The root pads its `<input>` beside an inline addon through `[&>input]:`.
  tag: "input",
  shownIn: always,
  classesFor: () => cn(inputClass, inputGroupInputControlClass),
  label: {
    key: "text",
    name: "text",
    characters: INPUT_GROUP_TEXT,
    textProperty: "Text",
    shownIn: always,
    placement: { horizontal: "start", vertical: "center", lines: "single" },
    textAttribute: () => "placeholder",
  },
  iconsFor: () => [],
};

/** Command's search glyph, a bare `<svg>` in the leading addon, fixed, so no swap property picks it. */
const SEARCH_ICON: IconSlot = {
  key: "search",
  name: "Search",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "MagnifyingGlass",
  swapProperty: undefined,
};

/** The leading addon of `form=search`. */
const LEADING: PartDefinition = {
  key: "addon-start",
  slot: "input-group-addon",
  shownIn: (cell) => cell.form === "search",
  classesFor: () => inputGroupAddonVariants({ align: "inline-start" }),
  label: undefined,
  iconsFor: () => [SEARCH_ICON],
};

/** The disabled Icon button state where the group is disabled, as Combobox disables its buttons too. */
function buttonCell(cell: Cell): Cell {
  return { variant: "ghost", size: "icon-sm", state: cell.state === "disabled" ? "disabled" : "rest" };
}

/**
 * What holds on Combobox's caret trigger: a direct `<svg>`, no clear beside it, no selection, and,
 * while the popup is open, Base UI's `data-popup-open`, `aria-expanded` and `data-pressed`, which
 * the CaretDown's `in-data-popup-open:` reads to turn half a turn.
 */
function caretFacts(open: boolean): ReadonlyArray<readonly [string, (cell: Cell) => boolean]> {
  const isOpen = (): boolean => open;
  return [
    ["has-[>svg]", always],
    // The caret shows only where the group holds no clear button.
    ["group-has-data-[slot=combobox-clear]/input-group", never],
    ["data-pressed", isOpen],
    ["data-popup-open", isOpen],
    ["aria-expanded", isOpen],
    ["in-data-popup-open", isOpen],
    // Base UI stamps the trigger while nothing is selected, and the composites select nothing.
    ["data-placeholder", always],
  ];
}

/**
 * Combobox's caret trigger: `InputGroup.Button` rendering `Combobox.Trigger`, an `Icon button`
 * instance with CaretDown, which Combobox renders with `caret()`. Inside an invalid Field Base UI
 * marks the trigger `aria-invalid` and `data-invalid` too, so it paints Button's invalid face, which
 * no `Icon button` state shows. Facts read the inner cell, so the invalid cells hold a second
 * instance whose facts hold both, and the diff carries the face as overrides. The open form's caret
 * holds the open trigger's facts, so its CaretDown turns half a turn, which the instance draws as a
 * swap to CaretUp, its proven half-turn mirror.
 */
function caret(invalid: boolean, open: boolean): InstanceDefinition {
  return {
    kind: "instance",
    key: ["caret", ...(open ? ["open"] : []), ...(invalid ? ["invalid"] : [])].join("-"),
    of: ICON_BUTTON,
    cell: buttonCell,
    slot: "input-group-button",
    classesFor: () => cn(inputGroupButtonVariants({ size: "icon-sm" }), inputTrigger(), trigger()),
    properties: () => ({ swap: { Icon: "CaretDown" } }),
    swapClasses: () => ({ Icon: caretGlyph() }),
    facts: new Map([...caretFacts(open), ["aria-invalid", () => invalid], ["data-invalid", () => invalid]]),
    shownIn: (cell) =>
      cell.form === (open ? "caret open" : "caret") && (cell.state === "invalid") === invalid,
  };
}

/** Combobox's clear button: `Combobox.Clear` rendering `InputGroup.Button`. */
const CLEAR: InstanceDefinition = {
  kind: "instance",
  key: "clear",
  of: ICON_BUTTON,
  cell: buttonCell,
  slot: "combobox-clear",
  classesFor: () => inputGroupButtonVariants({ size: "icon-sm" }),
  properties: () => ({ swap: { Icon: "X" } }),
  facts: new Map([["has-[>svg]", always]]),
  shownIn: (cell) => cell.form === "clear",
};

/** The trailing addon of `form=caret` and `form=clear`. */
const TRAILING: PartDefinition = {
  key: "addon-end",
  slot: "input-group-addon",
  shownIn: trails,
  classesFor: () => inputGroupAddonVariants({ align: "inline-end" }),
  label: undefined,
  iconsFor: () => [],
  parts: [caret(false, false), caret(true, false), caret(false, true), caret(true, true), CLEAR],
};

/**
 * An input group, as `<Combobox.Input>`, `<Combobox.Input showClear showTrigger={false}>` or
 * `<Command.Input>`, disabled or inside an invalid `Field.Root`.
 */
export const INPUT_GROUP: ComponentDefinition = {
  key: "input-group",
  name: "Input group",
  slot: "input-group",
  // The control takes the states, and the root reads them from it.
  rootKind: "native-control",
  statePart: "input-group-control",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [
    { name: "form", values: FORMS },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  classesFor: () => inputGroupRootClass,
  ancestorsFor: (cell) => (cell.state === "invalid" ? [FIELD_ROOT] : []),
  states: {},
  facts: new Map([
    ["has-[[data-focus-ring-control]:focus-visible]", (cell: Cell) => cell.state === "focus"],
    ["has-[>[data-focus-ring-control]:disabled]", (cell: Cell) => cell.state === "disabled"],
    ["has-[>[data-focus-ring-control][aria-invalid=true]]", (cell: Cell) => cell.state === "invalid"],
    ["has-[>[data-align=inline-start]]", (cell: Cell) => cell.form === "search"],
    ["has-[>[data-align=inline-end]]", trails],
    // Only the trailing addon holds a button.
    ["has-[>button]", trails],
    // The control holds no value, so it shows its placeholder.
    ["placeholder", always],
    // Base UI marks an open Combobox's input `data-popup-open` and `data-pressed`, as it marks the caret.
    ["data-popup-open", (cell: Cell) => cell.form === "caret open"],
    ["data-pressed", (cell: Cell) => cell.form === "caret open"],
  ]),
  omittedStates: new Set([
    "aria-disabled",
    "[&[readonly]:not(:disabled)]",
    "entry-floor",
    "has-[>[data-focus-ring-control][readonly]:not(:disabled)]",
    "has-[>[data-focus-ring-control][aria-disabled=true]]",
    "has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]",
  ]),
  omittedPseudoElements: new Map([["file", "the button of a file input, which the kit does not draw"]]),
  omittedCompositions: new Map([
    FIELD_ROOT_SR_ONLY,
    [
      FIELD_ROOT_STRETCH,
      "the Field stretches the group to its width, which the group's own `w-full` already takes",
    ],
    [
      "has-[>[data-align=block-start]]",
      "a block addon above the control, which neither Combobox nor Command renders",
    ],
    [
      "has-[>[data-align=block-end]]",
      "a block addon below the control, which neither Combobox nor Command renders",
    ],
    ["has-[>textarea]", "a textarea in the group, which neither Combobox nor Command renders"],
    ["has-[>kbd]", "a kbd in an addon, which neither Combobox nor Command renders"],
    ["[&>kbd]", "a kbd in an addon, which neither Combobox nor Command renders"],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [CONTROL, LEADING, TRAILING],
  swapProperties: [],
};
