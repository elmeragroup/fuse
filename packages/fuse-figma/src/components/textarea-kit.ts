/**
 * Textarea, as one component set: a placeholder and a typed value, in five states: 10 cells. The
 * root is Fuse's `<textarea data-slot="textarea">`, a native control, with `textareaClass`. It shares
 * its matrix, states, text colors and omissions with Input through `field-box-kit.ts`.
 *
 * - The box draws the field box with Input's corner, border, fill and shadow, at the md inline
 *   padding and 8px block padding. `field-sizing-content` makes its height hug its text, and
 *   `min-h-16` keeps it at least 64px tall.
 * - The text is one TEXT property, `Text`, that starts as the docs' placeholder, on one line in the
 *   value cells too. A `<textarea>` wraps its value at its content box's width from the top left,
 *   whatever its `flex` says, so the label fills the row between the paddings and its height follows
 *   its lines, with no ellipsis.
 * - A `<textarea>` holds its placeholder in `placeholder` and its value as its own text.
 */
import { textareaClass } from "@elmeragroup/fuse/recipe-catalog";

import type { ComponentDefinition } from "./component-spec";
import { FIELD_BOX_SET, showsPlaceholder } from "./field-box-kit";

/** The text every cell shows, the default of the `Text` property: the docs' basic placeholder. */
export const TEXTAREA_TEXT = "Tell us more…";

/**
 * A textarea, as `<Textarea placeholder>` or `<Textarea defaultValue>`, with `readOnly` or
 * `disabled`, or through `Field.Control` inside an invalid `Field.Root`.
 */
export const TEXTAREA: ComponentDefinition = {
  ...FIELD_BOX_SET,
  key: "textarea",
  name: "Textarea",
  slot: "textarea",
  classesFor: () => textareaClass,
  label: {
    key: "text",
    name: "text",
    characters: TEXTAREA_TEXT,
    textProperty: "Text",
    shownIn: () => true,
    placement: { horizontal: "start", vertical: "top", lines: "wrap" },
    textAttribute: (cell) => (showsPlaceholder(cell) ? "placeholder" : undefined),
  },
};
