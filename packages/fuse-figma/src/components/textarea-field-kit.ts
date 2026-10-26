/**
 * Textarea field, as one component set on the Textarea page: the docs Basic demo's labelled
 * textarea in five states, 5 cells. The root is `TextareaField`'s `Field.Root`, Base UI's `<div
 * data-slot="field">` with the `root` slot of `fieldVariants`, a column `surface-gap-md` apart.
 *
 * - The heading row is FieldFrame's label row with TextareaField's 8px gap: a `Label` instance and,
 *   behind the `Counter` BOOLEAN property, the character counter at the row's end in 12px
 *   `muted-foreground`. The docs Basic demo shows no counter, so the property starts off; the
 *   Counter demo's `maxLength={120}` shows `0/120` over an empty textarea.
 * - The control is a `Textarea` instance in the cell's state, holding the Basic demo's placeholder.
 *   `Field.Control` renders it, so it carries `data-slot="field-control"`, which takes the states.
 * - A `Field error` instance follows the control in the invalid cell, where Base UI renders the
 *   error, and a `Field description` instance closes the column.
 * - An invalid Field passes its `data-invalid:text-error` down, so the label's text turns `error`,
 *   which the Label instance carries as an override. A disabled Field dims the label through
 *   `group-data-disabled/field:`, which the Label instance's disabled variant draws. The counter and
 *   the description keep their own color in every state.
 * - Base UI stamps the Field's disabled or invalid state on the label and the description as data
 *   attributes, and an instance's facts read its inner cell, so the cells with a stamp hold their own
 *   label or description instance, whose facts hold it.
 * - The Field stretches each child to its width. The column's stretch gives them that width
 *   already, so the stretch is omitted.
 */
import {
  cn,
  fieldFrameVariants,
  fieldVariants,
  textareaFieldVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { FIELD_ROOT_SR_ONLY, FIELD_ROOT_STRETCH } from "./field-box-kit";
import { FIELD_DESCRIPTION, FIELD_ERROR } from "./field-text-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { LABEL } from "./label-kit";
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

/** Whether a cell is invalid, where Base UI renders the Field's error. */
function isInvalid(cell: Cell): boolean {
  return cell.state === "invalid";
}

/**
 * The Field's label, a `Label` instance, dimmed in a disabled Field. Base UI stamps an invalid
 * Field's `data-invalid` on the label, which no Label cell shows, and facts read the inner cell, so
 * the invalid cell holds a second instance whose fact holds it.
 */
function label(invalid: boolean): InstanceDefinition {
  return {
    kind: "instance",
    key: invalid ? "label-invalid" : "label",
    of: LABEL,
    cell: (outer) => ({ state: outer.state === "disabled" ? "disabled" : "rest" }),
    properties: () => ({ text: { Label: TEXTAREA_FIELD_LABEL } }),
    facts: new Map([["data-invalid", () => invalid]]),
    shownIn: (cell) => isInvalid(cell) === invalid,
    exposed: true,
  };
}

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
const LABEL_ROW: PartDefinition = {
  key: "label-row",
  slot: undefined,
  shownIn: always,
  classesFor: () => cn(frame.labelRow(), parts.labelRow()),
  label: undefined,
  iconsFor: () => [],
  parts: [label(false), label(true), COUNTER],
};

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

/** The error under the control, which an invalid Field shows. */
const ERROR: InstanceDefinition = {
  kind: "instance",
  key: "error",
  of: FIELD_ERROR,
  cell: () => ({ state: "invalid" }),
  properties: () => ({ text: { Text: TEXTAREA_FIELD_ERROR } }),
  shownIn: isInvalid,
  exposed: true,
};

/** The Field state Base UI stamps on the description: none, `data-disabled` or `data-invalid`. */
type DescriptionStamp = "none" | "disabled" | "invalid";

/** The stamp a cell's Field puts on its description. */
function stampOf(cell: Cell): DescriptionStamp {
  return cell.state === "disabled" || cell.state === "invalid" ? cell.state : "none";
}

/**
 * The description that closes the column, with FieldFrame's `text-pretty`. Base UI stamps the
 * Field's disabled or invalid state on it, and facts read the inner cell, so each stamp is its own
 * instance whose facts hold it. The description's classes read neither attribute.
 */
function description(stamp: DescriptionStamp): InstanceDefinition {
  return {
    kind: "instance",
    key: stamp === "none" ? "description" : `description-${stamp}`,
    of: FIELD_DESCRIPTION,
    cell: () => ({ state: "rest" }),
    classesFor: () => frame.description(),
    properties: () => ({ text: { Text: TEXTAREA_FIELD_DESCRIPTION } }),
    facts: new Map([
      ["data-disabled", () => stamp === "disabled"],
      ["data-invalid", () => stamp === "invalid"],
    ]),
    shownIn: (cell) => stampOf(cell) === stamp,
    exposed: true,
  };
}

/**
 * A textarea field, as `<TextareaField label description placeholder maxLength?>`, read-only,
 * disabled or invalid with an error message.
 */
export const TEXTAREA_FIELD: ComponentDefinition = {
  key: "textarea-field",
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
    disabled: ["group-data-disabled/field"],
    // The read-only textarea, as Textarea's own state renders it.
    readonly: ["[&[readonly]:not(:disabled)]"],
  },
  // The textarea holds no value, so it shows its placeholder.
  facts: new Map([["placeholder", always]]),
  omittedStates: new Set(),
  omittedCompositions: new Map([
    FIELD_ROOT_SR_ONLY,
    [
      FIELD_ROOT_STRETCH,
      "the Field stretches each child to its width, which the column's stretch already gives them",
    ],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [LABEL_ROW, CONTROL, ERROR, description("none"), description("disabled"), description("invalid")],
  swapProperties: [],
};
