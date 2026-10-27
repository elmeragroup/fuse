/**
 * Textarea field, as one component set on the Textarea page: the docs Basic demo's labelled
 * textarea in five states, 5 cells. The root is `TextareaField`'s `Field.Root`, Base UI's `<div
 * data-slot="field">` with the `root` slot of `fieldVariants`, a column `surface-gap-md` apart.
 *
 * - The heading row is FieldFrame's label row with TextareaField's 8px gap: a `Label` instance and,
 *   behind the `Counter` BOOLEAN property, the character counter at the row's end in 12px
 *   `muted-foreground`. The docs Basic demo shows no counter, so the property starts off; the
 *   Counter demo's `maxLength={120}` shows `0/120` over an empty textarea. The row packs its children
 *   with `SPACE_BETWEEN`, and with the counter hidden Figma packs the lone label at the start, as
 *   CSS's `justify-between` does (W5-P1).
 * - The control is a `Textarea` instance in the cell's state, holding the Basic demo's placeholder.
 *   `Field.Control` renders it, so it carries `data-slot="field-control"`, which takes the states.
 * - A `Field error` instance follows the control in the invalid cell, where Base UI renders the
 *   error, and a `Field description` instance closes the column.
 * - The label, the error and the description, and the states Base UI stamps on them, come from
 *   `field-frame-kit.ts`.
 */
import {
  cn,
  fieldFrameVariants,
  fieldVariants,
  textareaFieldVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import type { ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import {
  FIELD_FRAME_DISABLED,
  FIELD_FRAME_OMISSIONS,
  frameDescriptions,
  frameError,
  frameLabelRow,
} from "./field-frame-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";
import { TEXTAREA } from "./textarea-kit";

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
export const TEXTAREA_FIELD_COUNTER = `0/${TEXTAREA_FIELD_MAX_LENGTH}`;

/** The BOOLEAN property that shows the counter. */
export const TEXTAREA_FIELD_COUNTER_PROPERTY = "Counter";

const frame = fieldFrameVariants();
const parts = textareaFieldVariants();

/** The `current/max` character counter at the end of the heading row, a bare `<span>`. */
const COUNTER: PartDefinition = {
  key: "counter",
  slot: undefined,
  shownIn: always,
  optional: { name: TEXTAREA_FIELD_COUNTER_PROPERTY, defaultValue: false },
  classesFor: () => parts.counter(),
  label: {
    key: "text",
    name: "text",
    characters: TEXTAREA_FIELD_COUNTER,
    textProperty: "Count",
    shownIn: always,
  },
  iconsFor: () => [],
};

/** FieldFrame's heading row, with TextareaField's gap between the label and the counter. */
const LABEL_ROW = frameLabelRow(TEXTAREA_FIELD_LABEL, cn(frame.labelRow(), parts.labelRow()), [COUNTER]);

/** The control, a `Textarea` instance in the cell's state, holding the placeholder. */
const CONTROL: InstanceDefinition = {
  kind: "instance",
  key: "textarea",
  of: TEXTAREA,
  // `Field.Control` renders the Textarea and stamps its own slot over the textarea's.
  slot: "field-control",
  cell: (outer) => ({ content: "placeholder", state: outer.state ?? "rest" }),
  properties: () => ({ text: { Text: TEXTAREA_FIELD_PLACEHOLDER } }),
  shownIn: always,
  exposed: true,
};

/**
 * A textarea field, as `<TextareaField label description placeholder maxLength?>`, read-only,
 * disabled or invalid with an error message.
 */
export const TEXTAREA_FIELD: ComponentDefinition = {
  key: "textarea-field",
  // CSS leaves the root unclipped, so a ring a layer draws at its edge shows past it (compare-real-1).
  rootOverflow: "visible",
  name: "Textarea field",
  slot: "field",
  // The textarea takes the states, and Base UI mirrors them on the Field root as data attributes.
  rootKind: "native-control",
  statePart: "field-control",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [{ name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] }],
  columnAxis: "state",
  classesFor: () => fieldVariants().root(),
  // The root is the `group/field` a disabled Field marks `data-disabled`, which the label reads.
  states: {
    disabled: FIELD_FRAME_DISABLED,
    // The read-only textarea, as Textarea's own state renders it.
    readonly: ["[&[readonly]:not(:disabled)]"],
  },
  // The textarea holds no value, so it shows its placeholder.
  facts: new Map([["placeholder", always]]),
  omittedStates: new Set(),
  omittedCompositions: FIELD_FRAME_OMISSIONS,
  label: undefined,
  iconsFor: () => [],
  parts: [
    LABEL_ROW,
    CONTROL,
    frameError(TEXTAREA_FIELD_ERROR),
    ...frameDescriptions(TEXTAREA_FIELD_DESCRIPTION),
  ],
  swapProperties: [],
};
