/**
 * Textarea field, as one component set on the Textarea page: the docs Basic demo's labelled
 * textarea in five states, 5 cells. The root is `TextareaField`'s `Field.Root`, Base UI's `<div
 * data-slot="field">`.
 *
 * - The heading row is FieldFrame's label row: a `Label` instance and, behind the `Counter` BOOLEAN
 *   property, the character counter, a bare `<span>`, at the row's end. The docs Basic demo shows no
 *   counter, so the property starts off; the Counter demo's `maxLength={120}` shows `0/120` over an
 *   empty textarea. With the counter hidden, Figma packs the lone label at the start, as CSS's
 *   `justify-between` does (W5-P1).
 * - The control is a `Textarea` instance in the cell's state, holding the Basic demo's placeholder.
 *   `Field.Control` renders it, so it carries `data-slot="field-control"`, and it takes the states.
 * - A `Field error` instance follows the control in the invalid cell, where Base UI renders the
 *   error, and a `Field description` instance closes the column.
 * - The label, the error and the description, and the states Base UI stamps on them, come from
 *   `field-frame-kit.ts`.
 */
import type { LabelManifest, SetManifest } from "../capture/manifest";
import { frameLabelRowManifest, frameMessagesManifest } from "./field-frame-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";
import { TEXTAREA_MANIFEST } from "./textarea-kit";

/** The label, the default of the Label instance's `Label` property: the docs Basic demo's label. */
export const TEXTAREA_FIELD_LABEL = "Bio";

/** The placeholder the Textarea instance shows: the docs Basic demo's placeholder. */
export const TEXTAREA_FIELD_PLACEHOLDER = "Write a short bio.";

/** The description: the docs Basic demo's description. */
export const TEXTAREA_FIELD_DESCRIPTION = "Shown to other users.";

/** The error the invalid cell shows: the docs Error demo's message. */
export const TEXTAREA_FIELD_ERROR = "Keep it under 120 characters.";

/** The counter's `maxLength`, the docs Counter demo's. */
export const TEXTAREA_FIELD_MAX_LENGTH = 120;

/** The counter over the empty textarea: no characters of {@link TEXTAREA_FIELD_MAX_LENGTH}. */
const TEXTAREA_FIELD_COUNTER = `0/${TEXTAREA_FIELD_MAX_LENGTH}`;

/** The BOOLEAN property that shows the counter. */
export const TEXTAREA_FIELD_COUNTER_PROPERTY = "Counter";

/** The BOOLEAN property that shows the counter, which starts false. */
const COUNTER_OPTIONAL = { name: TEXTAREA_FIELD_COUNTER_PROPERTY, defaultValue: false };

/** The counter's text, which the `Count` property sets. */
const COUNTER_TEXT: LabelManifest = {
  key: "text",
  name: "text",
  characters: TEXTAREA_FIELD_COUNTER,
  textProperty: "Count",
  shownIn: always,
};

/**
 * The textarea field's manifest, which the capture-backed build reads with
 * `captures/textarea-field.json`, as `<TextareaField label description placeholder maxLength?>`
 * renders it, read-only, disabled or invalid with an error message: the label row with the counter
 * beside the label, the textarea, then the messages.
 */
export const TEXTAREA_FIELD_MANIFEST: SetManifest = {
  key: "textarea-field",
  name: "Textarea field",
  slot: "field",
  statePart: "field-control",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [{ name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    frameLabelRowManifest(TEXTAREA_FIELD_LABEL, "field/0", [
      {
        key: "counter",
        slot: undefined,
        place: "field/0/1",
        shownIn: always,
        optional: COUNTER_OPTIONAL,
        label: COUNTER_TEXT,
        iconsFor: () => [],
      },
    ]),
    {
      kind: "instance",
      key: "textarea",
      of: TEXTAREA_MANIFEST,
      // `Field.Control` renders the Textarea and stamps its own slot over the textarea's.
      slot: "field-control",
      cell: (outer) => ({ content: "placeholder", state: outer.state ?? "rest" }),
      properties: () => ({ text: { Text: TEXTAREA_FIELD_PLACEHOLDER } }),
      shownIn: always,
      exposed: true,
    },
    ...frameMessagesManifest(TEXTAREA_FIELD_ERROR, TEXTAREA_FIELD_DESCRIPTION),
  ],
  swapProperties: [],
};
