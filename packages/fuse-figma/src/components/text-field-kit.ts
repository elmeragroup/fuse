/**
 * Text field, as one component set on the Input page: `TextField` in its default variant, holding
 * the placeholder or a typed value, in Input's five states: 10 cells. The root is the `Field.Root`,
 * Base UI's `<div data-slot="field">`.
 *
 * - The heading row is FieldFrame's label row holding a `Label` instance.
 * - TextField always gives FieldFrame its content wrapper, a column that holds the input's
 *   container, the error in an invalid Field and the description.
 * - The container is a bare `<div>` around the `<input>`. A real file drew the container exactly as
 *   tall as the Input instance at both densities (W5-P4).
 * - The control is an `Input` instance in the cell's content and state, holding the docs Basic
 *   demo's placeholder. The value cells type the same text, as Input's do. The input takes the
 *   states.
 * - The label, the error and the description, and the states Base UI stamps on them, come from
 *   `field-frame-kit.ts`, with the Basic demo's copy and the Error demo's message.
 * - Left out: the card variant draws the Field as a Card, and the kit has no Card set yet. The inline
 *   variant gives the input the width its `size` attribute and the font's character widths give it,
 *   168px dense and 217px comfortable in Chromium, which no Figma length holds. TextField's trailing
 *   icon renders only with `icon`, which no cell passes.
 */
import type { SetManifest } from "../capture/manifest";
import { FIELD_BOX_AXES } from "./field-box-kit";
import { frameLabelRowManifest, frameMessagesManifest } from "./field-frame-kit";
import { INPUT_MANIFEST } from "./input-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";

/** The label: the docs Basic demo's. */
export const TEXT_FIELD_LABEL = "Email";

/** The placeholder, and the text a value cell types: the docs Basic demo's placeholder. */
export const TEXT_FIELD_PLACEHOLDER = "name@example.com";

/** The description: the docs Basic demo's. */
export const TEXT_FIELD_DESCRIPTION = "Work address preferred.";

/** The error the invalid cells show: the docs Error demo's message. */
export const TEXT_FIELD_ERROR = "Enter a work email.";

/**
 * The Text field's manifest, which the capture-backed build reads with `captures/text-field.json`,
 * as `<TextField label description placeholder defaultValue?>` renders it, read-only, disabled, or
 * invalid with an error message: the label row, then the content column, which holds the input's
 * container and the messages.
 */
export const TEXT_FIELD_MANIFEST: SetManifest = {
  key: "text-field",
  name: "Text field",
  slot: "field",
  statePart: "input",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: FIELD_BOX_AXES,
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
  parts: [
    frameLabelRowManifest(TEXT_FIELD_LABEL, "field/0"),
    {
      key: "content",
      slot: undefined,
      place: "field/1",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "input-container",
          slot: undefined,
          place: "field/1/0",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [
            {
              kind: "instance",
              key: "input",
              of: INPUT_MANIFEST,
              cell: (outer) => ({ content: outer.content ?? "placeholder", state: outer.state ?? "rest" }),
              properties: () => ({ text: { Text: TEXT_FIELD_PLACEHOLDER } }),
              shownIn: always,
              exposed: true,
            },
          ],
        },
        ...frameMessagesManifest(TEXT_FIELD_ERROR, TEXT_FIELD_DESCRIPTION),
      ],
    },
  ],
};
