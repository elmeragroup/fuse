/**
 * Select field, as one component set on the Select page: the docs Basic demo's labelled select in
 * four states, holding the placeholder or a value, 8 cells. The root is `SelectField`'s
 * `Field.Root`, Base UI's `<div data-slot="field">` with the `root` slot of `fieldVariants` and
 * FieldFrame's part spacing, `group flex flex-col gap-1`, so its children sit 4px apart.
 *
 * - The heading row is FieldFrame's label row holding a `Label` instance, `Plan`. The row fills the
 *   column and packs the lone label with `SPACE_BETWEEN`, which Figma puts at the start, as CSS's
 *   `justify-between` does (W5-P1).
 * - The control is a `Select trigger` instance at `width=fill` and the default size, closed, in the
 *   cell's state and content. SelectField passes the trigger `w-full`, which that variant draws: it
 *   fills the column, its value grows and its caret sits at the end. Its
 *   `Value` property holds the Basic demo's placeholder, `Choose a plan`, or the Form demo's value,
 *   `Pro`.
 * - Base UI renders a visually hidden `<input>` after the trigger, which holds the value for a form.
 *   It is fixed in place and clipped to nothing, so the set draws no layer for it.
 * - A `Field error` instance follows the control in the invalid cell, with the States demo's message,
 *   and a `Field description` instance closes the column. They and the label, and the states Base UI
 *   stamps on them, come from `field-frame-kit.ts`.
 */
import { cn, fieldFrameVariants, fieldVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition } from "./component-spec";
import { showsPlaceholder } from "./field-box-kit";
import {
  FIELD_FRAME_DISABLED,
  FIELD_FRAME_SET,
  frameDescriptions,
  frameError,
  frameLabelRow,
} from "./field-frame-kit";
import { always } from "./popup-facts";
import { SELECT_TRIGGER } from "./select-trigger-kit";

/** The label, the default of the Label instance's `Label` property: the docs Basic demo's label. */
export const SELECT_FIELD_LABEL = "Plan";

/** The placeholder the trigger shows while nothing is selected: the docs Basic demo's placeholder. */
export const SELECT_FIELD_PLACEHOLDER = "Choose a plan";

/** The label of the selected item a `content=value` cell shows: the docs Form demo's `pro`. */
export const SELECT_FIELD_VALUE = "Pro";

/** The description: the docs Basic demo's description. */
export const SELECT_FIELD_DESCRIPTION = "You can change plan later.";

/** The error the invalid cell shows: the docs States demo's message. */
export const SELECT_FIELD_ERROR = "Choose a plan to continue.";

const frame = fieldFrameVariants();

/** The trigger, a filling `Select trigger` instance, with the `w-full` SelectField passes it. */
const TRIGGER: InstanceDefinition = {
  kind: "instance",
  key: "trigger",
  of: SELECT_TRIGGER,
  cell: (outer) => ({
    width: "fill",
    size: "default",
    state: outer.state ?? "rest",
    content: outer.content ?? "placeholder",
    open: "off",
  }),
  classesFor: () => "w-full",
  properties: (outer) => ({
    text: { Value: showsPlaceholder(outer) ? SELECT_FIELD_PLACEHOLDER : SELECT_FIELD_VALUE },
  }),
  shownIn: always,
  exposed: true,
};

/**
 * A select field, as `<SelectField label description placeholder items defaultValue?>`, disabled,
 * or invalid with an error message.
 */
export const SELECT_FIELD: ComponentDefinition = {
  ...FIELD_FRAME_SET,
  key: "select-field",
  name: "Select field",
  // The trigger takes the states, and Base UI mirrors them on the Field root as data attributes.
  rootKind: "native-control",
  statePart: "select-trigger",
  axes: [
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
    { name: "content", values: ["placeholder", "value"] },
  ],
  classesFor: () => cn(fieldVariants().root(), frame.root()),
  states: { disabled: FIELD_FRAME_DISABLED },
  // Base UI stamps the trigger while nothing is selected.
  facts: new Map([["data-placeholder", (cell: Cell) => showsPlaceholder(cell)]]),
  parts: [
    frameLabelRow(SELECT_FIELD_LABEL, frame.labelRow()),
    TRIGGER,
    frameError(SELECT_FIELD_ERROR),
    ...frameDescriptions(SELECT_FIELD_DESCRIPTION),
  ],
};
