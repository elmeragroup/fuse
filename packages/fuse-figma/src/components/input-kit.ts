/**
 * Input, as one component set: a placeholder and a typed value, in five states: 10 cells. The root
 * is Base UI's `<input data-slot="input">`, a native control, with `inputClass`.
 *
 * - The box is 384px wide, the preview width its `w-full` takes, as the docs' widest field
 *   (`max-w-sm`) is. It draws the field box: the field corner `radius-field-box`, a 1px `input`
 *   border, a `card` fill and `shadow-xs`, at the md control height and inline padding.
 * - The text is one TEXT property, `Text`, that starts as the docs' placeholder. An `<input>` draws
 *   its value on one line from the start of its content box, centered down it, whatever its
 *   classes say, so the label fills the row between the paddings and ends in an ellipsis.
 * - `content=placeholder` holds `placeholder:`, so the text paints `muted-foreground`. A typed value
 *   inherits the page's `foreground`, or the `error` an invalid Field root passes down through its
 *   `data-invalid:text-error`.
 * - Read-only fills with `muted` through `[&[readonly]:not(:disabled)]`, the `readonly` attribute
 *   Input renders for `readOnly`. Disabled dims to 50% on the `input/50` fill.
 * - Invalid draws the `error` border and ring of an input inside an invalid Field. The recipe's
 *   invalid focus ring needs invalid and focus at once, which no cell draws.
 * - A disabled `<input>` is natively disabled, and Base UI never marks it `aria-disabled`, so no
 *   cell shows the state face's `aria-disabled:` arm. `entry-floor:` raises the text to 16px for a
 *   coarse pointer or iOS WebKit, and the kit draws a desktop with a fine pointer.
 */
import { inputClass } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, OuterDeclaration } from "./component-spec";

/** The text every cell shows, the default of the `Text` property: the docs' basic placeholder. */
export const INPUT_TEXT = "name@example.com";

/** The width the root's `w-full` takes, in the Figma preview and on the compare page. */
export const INPUT_PREVIEW_WIDTH = 384;

const showsPlaceholder = (cell: Cell): boolean => cell.content === "placeholder";

/**
 * The text color an invalid Field root sets, `data-invalid:text-error` in `field-variants.ts`, which
 * the input inherits, as preflight gives a form control `color: inherit`.
 */
const INVALID_FIELD: readonly OuterDeclaration[] = [
  { className: "Field.Root data-invalid:text-error", property: "color", value: "var(--error)" },
];

/**
 * An input, as `<Input placeholder>` or `<Input defaultValue>`, with `readOnly` or `disabled`, or
 * inside an invalid `Field.Root`.
 */
export const INPUT: ComponentDefinition = {
  key: "input",
  name: "Input",
  slot: "input",
  rootKind: "native-control",
  previewWidth: INPUT_PREVIEW_WIDTH,
  axes: [
    { name: "content", values: ["placeholder", "value"] },
    { name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] },
  ],
  columnAxis: "state",
  classesFor: () => inputClass,
  inheritedFor: (cell) => (cell.state === "invalid" ? INVALID_FIELD : []),
  states: { readonly: ["[&[readonly]:not(:disabled)]"] },
  facts: new Map([["placeholder", showsPlaceholder]]),
  omittedStates: new Set(["aria-disabled", "entry-floor"]),
  omittedPseudoElements: new Map([["file", "the button of a file input, which the kit does not draw"]]),
  label: {
    key: "text",
    name: "text",
    characters: INPUT_TEXT,
    textProperty: "Text",
    shownIn: () => true,
    placement: { horizontal: "start", vertical: "center", lines: "single" },
    textAttribute: (cell) => (showsPlaceholder(cell) ? "placeholder" : "value"),
  },
  iconsFor: () => [],
  swapProperties: [],
};
