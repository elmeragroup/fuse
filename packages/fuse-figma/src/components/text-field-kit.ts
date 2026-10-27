/**
 * Text field, as one component set on the Input page: `TextField` in its default variant, holding
 * the placeholder or a typed value, in Input's five states: 10 cells. The root is the `Field.Root`,
 * Base UI's `<div data-slot="field">`, with FieldFrame's part spacing and `textFieldVariants`'
 * `base`, so its children sit 4px apart.
 *
 * - The heading row is FieldFrame's label row holding a `Label` instance, packed at its start as
 *   `justify-between` packs a lone layer.
 * - TextField always gives FieldFrame its content wrapper, a `flex flex-col gap-1` column, which
 *   holds the input's `relative` container, the error in an invalid Field and the description.
 * - The container is a bare `<div>`, a block box, around the `<input>`, an inline-block as wide as
 *   it, so the input spans the container's one line and the container draws as a column the input
 *   fills, as `box-flow.ts` says. A real file drew the container exactly as tall as the Input instance
 *   at both densities (W5-P4).
 * - The control is an `Input` instance in the cell's content and state, holding the docs Basic
 *   demo's placeholder. The value cells type the same text, as Input's do.
 * - The label, the error and the description, and the states Base UI stamps on them, come from
 *   `field-frame-kit.ts`, with the Basic demo's copy and the Error demo's message.
 * - Left out: the card variant draws the Field as a Card, and the kit has no Card set yet. The inline
 *   variant's `fieldGroup` gives the input `w-auto`, so the input takes the width its `size`
 *   attribute and the font's character widths give it, 168px dense and 217px comfortable in
 *   Chromium, which no Figma length holds. TextField's trailing icon renders only with `icon`,
 *   which no cell passes, so its absolutely placed container draws in no cell.
 */
import { cn, fieldFrameVariants, fieldVariants, textFieldVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { userAgentDisplay } from "./element-defaults";
import { showsPlaceholder } from "./field-box-kit";
import {
  FIELD_FRAME_DISABLED,
  FIELD_FRAME_OMISSIONS,
  frameDescriptions,
  frameError,
  frameLabelRow,
} from "./field-frame-kit";
import { INPUT } from "./input-kit";
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

const frame = fieldFrameVariants();

/** The recipe's slots, as TextField calls it in its default variant with no icon. */
const slots = textFieldVariants({ hidden: false });

/** The Input, in the cell's content and state, with the classes TextField passes it. */
const CONTROL: InstanceDefinition = {
  kind: "instance",
  key: "input",
  of: INPUT,
  cell: (outer) => ({ content: outer.content ?? "placeholder", state: outer.state ?? "rest" }),
  classesFor: () => slots.input(),
  properties: () => ({ text: { Text: TEXT_FIELD_PLACEHOLDER } }),
  shownIn: always,
  exposed: true,
};

/** The input's container, which positions TextField's trailing icon. */
const INPUT_CONTAINER: PartDefinition = {
  key: "input-container",
  slot: undefined,
  shownIn: always,
  classesFor: () => slots.inputContainer(),
  // A bare `<div>`, a block box, so the input's `w-full` takes its width.
  elementDefaults: userAgentDisplay("div"),
  label: undefined,
  iconsFor: () => [],
  parts: [CONTROL],
};

/** FieldFrame's content wrapper: the input's container, then the error and the description. */
const CONTENT: PartDefinition = {
  key: "content",
  slot: undefined,
  // A bare `<div>` beside the heading row, found by its classes.
  element: { tag: "div", attributes: { class: slots.container() } },
  shownIn: always,
  classesFor: () => slots.container(),
  label: undefined,
  iconsFor: () => [],
  parts: [INPUT_CONTAINER, frameError(TEXT_FIELD_ERROR), ...frameDescriptions(TEXT_FIELD_DESCRIPTION)],
};

/**
 * A text field, as `<TextField label description placeholder defaultValue?>`, read-only, disabled,
 * or invalid with an error message.
 */
export const TEXT_FIELD: ComponentDefinition = {
  key: "text-field",
  // CSS leaves the root unclipped, so a ring a layer draws at its edge shows past it (compare-real-1).
  rootOverflow: "visible",
  name: "Text field",
  slot: "field",
  // The input takes the states, and Base UI mirrors them on the Field root as data attributes.
  rootKind: "native-control",
  statePart: "input",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [
    { name: "content", values: ["placeholder", "value"] },
    { name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] },
  ],
  columnAxis: "state",
  classesFor: () => cn(fieldVariants().root(), frame.root(), slots.base()),
  states: {
    disabled: FIELD_FRAME_DISABLED,
    readonly: ["[&[readonly]:not(:disabled)]"],
  },
  facts: new Map([["placeholder", showsPlaceholder]]),
  omittedStates: new Set(),
  omittedCompositions: FIELD_FRAME_OMISSIONS,
  label: undefined,
  iconsFor: () => [],
  parts: [frameLabelRow(TEXT_FIELD_LABEL, frame.labelRow()), CONTENT],
  swapProperties: [],
};
