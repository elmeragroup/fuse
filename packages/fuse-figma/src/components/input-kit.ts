/**
 * Input, as one component set: a placeholder and a typed value, in five states: 10 cells. The root
 * is Base UI's `<input data-slot="input">`, a native control, with `inputVariants()` at the default
 * field size. It shares its matrix, states, text colors and omissions with Textarea through
 * `field-box-kit.ts`.
 *
 * - The box draws the field box: the field corner `radius-field-box`, a 1px `input` border, a `card`
 *   fill and `shadow-xs`, at the md control height and inline padding.
 * - The text is one TEXT property, `Text`, that starts as the docs' placeholder. An `<input>` draws
 *   its value on one line from the start of its content box, centered down it, whatever its
 *   classes say, so the label fills the row between the paddings and ends in an ellipsis.
 * - `file:` styles the button of a file input, which the kit does not draw.
 */
import { inputVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { ComponentDefinition } from "./component-spec";
import { userAgentDisplay } from "./element-defaults";
import { FIELD_BOX_SET, FIELD_ROOT, showsPlaceholder } from "./field-box-kit";

/** The text every cell shows, the default of the `Text` property: the docs' basic placeholder. */
export const INPUT_TEXT = "name@example.com";

/**
 * An input, as `<Input placeholder>` or `<Input defaultValue>`, with `readOnly` or `disabled`, or
 * inside an invalid `Field.Root`.
 */
export const INPUT: ComponentDefinition = {
  ...FIELD_BOX_SET,
  key: "input",
  name: "Input",
  slot: "input",
  classesFor: () => inputVariants(),
  // An `<input>` is inline-block, which a block container around it, as TextField's, lays out.
  elementDefaults: userAgentDisplay("input"),
  // Only an invalid cell wraps the input in a Field root, the one source Base UI reads the input's
  // validity from.
  ancestorsFor: (cell) => (cell.state === "invalid" ? [FIELD_ROOT] : []),
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
};
