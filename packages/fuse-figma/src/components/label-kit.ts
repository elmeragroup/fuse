/**
 * Label, as one component set: the label a form shows above its control, at rest and disabled, 2
 * cells. Fuse has no standalone Label. This is `Field.Label`, Base UI's `<label
 * data-slot="field-label">` inside a `Field.Root`.
 *
 * - The label is the root's own text, `Email`, as the docs' field label, which the `Label` property
 *   sets.
 * - The disabled cell renders the label in a disabled Field.
 */
import type { LabelManifest, SetManifest } from "../capture/manifest";

/** The label's text, the default of its `Label` property: the docs' field label. */
export const LABEL_TEXT = "Email";

/** The label's text layer, which sets the `Label` property. */
const LABEL_LAYER: LabelManifest = {
  key: "label",
  name: "label",
  characters: LABEL_TEXT,
  textProperty: "Label",
  shownIn: () => true,
};

/**
 * The label's manifest, which the capture-backed build reads with `captures/label.json`, as
 * `<Field.Root disabled={…}><Field.Label>Email</Field.Label></Field.Root>` renders it.
 */
export const LABEL_MANIFEST: SetManifest = {
  key: "label",
  name: "Label",
  slot: "field-label",
  axes: [{ name: "state", values: ["rest", "disabled"] }],
  columnAxis: "state",
  label: LABEL_LAYER,
  iconsFor: () => [],
  swapProperties: [],
};
