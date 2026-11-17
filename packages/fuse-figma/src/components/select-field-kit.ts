/**
 * Select field, as one component set on the Select page: the docs Basic demo's labelled select in
 * four states, holding the placeholder or a value, 8 cells. The root is `SelectField`'s
 * `Field.Root`, Base UI's `<div data-slot="field">`.
 *
 * - The heading row is FieldFrame's label row holding a `Label` instance, `Plan`. Figma packs the
 *   lone label at the row's start, as CSS's `justify-between` does (W5-P1).
 * - The control is a `Select trigger` instance at `width=fill` and the default size, closed, in the
 *   cell's state and content, since SelectField passes the trigger `w-full`. The trigger takes the
 *   states. Its `Value` property holds the Basic demo's placeholder, `Choose a plan`, or the Form
 *   demo's value, `Pro`.
 * - Base UI renders a visually hidden `<input>` after the trigger, which holds the value for a form.
 *   It is fixed in place and clipped to nothing, so the set draws no layer for it.
 * - A `Field error` instance follows the control in the invalid cell, with the States demo's message,
 *   and a `Field description` instance closes the column. They and the label, and the states Base UI
 *   stamps on them, come from `field-frame-kit.ts`.
 */
import type { SetManifest } from "../capture/manifest";
import type { Cell, InstanceProperties } from "./component-spec";
import { showsPlaceholder } from "./field-box-kit";
import { frameLabelRowManifest, frameMessagesManifest } from "./field-frame-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";
import { SELECT_TRIGGER_MANIFEST } from "./select-trigger-kit";

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

/** The trigger's cell: filling, at the default size, closed, in the field's state and content. */
function triggerCell(outer: Cell): Cell {
  return {
    width: "fill",
    size: "default",
    state: outer.state ?? "rest",
    content: outer.content ?? "placeholder",
    open: "off",
  };
}

/** The trigger's `Value`: the placeholder, or the selected item's label. */
function triggerProperties(outer: Cell): InstanceProperties {
  return { text: { Value: showsPlaceholder(outer) ? SELECT_FIELD_PLACEHOLDER : SELECT_FIELD_VALUE } };
}

/**
 * The select field's manifest, which the capture-backed build reads with
 * `captures/select-field.json`, as `<SelectField label description placeholder items defaultValue?>`
 * renders it, disabled, or invalid with an error message: the label row, the trigger, then the
 * messages.
 */
export const SELECT_FIELD_MANIFEST: SetManifest = {
  key: "select-field",
  name: "Select field",
  slot: "field",
  statePart: "select-trigger",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
    { name: "content", values: ["placeholder", "value"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    frameLabelRowManifest(SELECT_FIELD_LABEL, "field/0"),
    {
      kind: "instance",
      key: "trigger",
      of: SELECT_TRIGGER_MANIFEST,
      cell: triggerCell,
      properties: triggerProperties,
      shownIn: always,
      exposed: true,
    },
    ...frameMessagesManifest(SELECT_FIELD_ERROR, SELECT_FIELD_DESCRIPTION),
  ],
  swapProperties: [],
};
