/**
 * Input, as one component set: a placeholder and a typed value, in five states: 10 cells. The root
 * is Base UI's `<input data-slot="input">`, a native control, at the default field size. It shares
 * its matrix and preview width with Textarea through `field-box-kit.ts`.
 *
 * - The text is one TEXT property, `Text`, that starts as the docs' placeholder. An `<input>` holds
 *   it in its `placeholder` or its `value` attribute.
 * - Only an invalid cell renders the input in a Field, the one source Base UI reads its validity
 *   from.
 */
import type { LabelManifest, SetManifest } from "../capture/manifest";
import { FIELD_BOX_AXES, showsPlaceholder } from "./field-box-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";

/** The text every cell shows, the default of the `Text` property: the docs' basic placeholder. */
export const INPUT_TEXT = "name@example.com";

/** The input's text, which an `<input>` holds in its `placeholder` or its `value`. */
const INPUT_LABEL: LabelManifest = {
  key: "text",
  name: "text",
  characters: INPUT_TEXT,
  textProperty: "Text",
  shownIn: () => true,
  textAttribute: (cell) => (showsPlaceholder(cell) ? "placeholder" : "value"),
};

/**
 * The input's manifest, which the capture-backed build reads with `captures/input.json`, as
 * `<Input placeholder>` or `<Input defaultValue>` renders it, with `readOnly` or `disabled`, or
 * inside an invalid `Field.Root`.
 */
export const INPUT_MANIFEST: SetManifest = {
  key: "input",
  name: "Input",
  slot: "input",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: FIELD_BOX_AXES,
  columnAxis: "state",
  label: INPUT_LABEL,
  iconsFor: () => [],
  swapProperties: [],
};
