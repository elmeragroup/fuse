/**
 * Textarea, as one component set: a placeholder and a typed value, in five states: 10 cells. The
 * root is Fuse's `<textarea data-slot="textarea">`, a native control, at the default field size. It
 * shares its matrix and preview width with Input through `field-box-kit.ts`.
 *
 * - The text is one TEXT property, `Text`, that starts as the docs' placeholder, on one line in the
 *   value cells too.
 * - A `<textarea>` holds its placeholder in `placeholder` and its value as its own text.
 * - Every cell renders the textarea through `Field.Control` inside a Field, as the docs' Field demo
 *   does, and only an invalid cell's Field is invalid.
 */
import type { LabelManifest, SetManifest } from "../capture/manifest";
import { FIELD_BOX_AXES, showsPlaceholder } from "./field-box-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";

/** The text every cell shows, the default of the `Text` property: the docs' basic placeholder. */
export const TEXTAREA_TEXT = "Tell us more…";

/** The text, in `placeholder` while the textarea shows it, which the `Text` property sets. */
const TEXT: LabelManifest = {
  key: "text",
  name: "text",
  characters: TEXTAREA_TEXT,
  textProperty: "Text",
  shownIn: () => true,
  textAttribute: (cell) => (showsPlaceholder(cell) ? "placeholder" : undefined),
};

/**
 * The textarea's manifest, which the capture-backed build reads with `captures/textarea.json`, as
 * `<Textarea placeholder>` or `<Textarea defaultValue>` renders it, with `readOnly` or `disabled`.
 */
export const TEXTAREA_MANIFEST: SetManifest = {
  key: "textarea",
  name: "Textarea",
  slot: "textarea",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: FIELD_BOX_AXES,
  columnAxis: "state",
  label: TEXT,
  iconsFor: () => [],
  swapProperties: [],
};
