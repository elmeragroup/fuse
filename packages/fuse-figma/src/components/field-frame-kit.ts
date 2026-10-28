/**
 * What the Field composites share, as Fuse's FieldFrame renders them: a `Field.Root` column holding
 * a heading row with the label, the control, the error in an invalid Field and the description.
 * Textarea field and Select field draw their parts from here.
 *
 * - The label, the error and the description are instances of `Label`, `Field error` and `Field
 *   description`, each exposed so a designer sets its text from the composite.
 * - Base UI stamps the Field's state on the label and the description as data attributes: a
 *   disabled Field marks them `data-disabled`, an invalid one `data-invalid`. An instance's facts
 *   read its inner cell, so each stamp is its own instance whose facts hold it. Neither inner set's
 *   classes read the attributes, so the instances draw the same.
 * - A disabled Field dims the label through `group-data-disabled/field:`, which the Label
 *   instance's disabled variant draws. An invalid Field passes its `data-invalid:text-error` to the
 *   label, which the instance carries as an override.
 * - The Field stretches each child to its width. The column's stretch gives them that width
 *   already, so the stretch is omitted.
 */
import { fieldFrameVariants, fieldVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { FIELD_ROOT_SR_ONLY, FIELD_ROOT_STRETCH } from "./field-box-kit";
import { FIELD_DESCRIPTION, FIELD_ERROR } from "./field-text-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { LABEL } from "./label-kit";
import { always } from "./popup-facts";

const frame = fieldFrameVariants();

/**
 * Whether a cell is invalid, where Base UI renders the Field's error.
 *
 * @param cell - A Field composite's cell.
 * @returns True at `state=invalid`.
 */
export function isInvalid(cell: Cell): boolean {
  return cell.state === "invalid";
}

/**
 * The Field's label, a `Label` instance, dimmed in a disabled Field. The invalid cell holds the
 * second instance, whose fact holds the `data-invalid` Base UI stamps there.
 *
 * @param text - The label's characters, set through the Label instance's `Label` property.
 * @param invalid - Whether this is the invalid cell's instance.
 * @returns The instance part.
 */
function frameLabel(text: string, invalid: boolean): InstanceDefinition {
  return {
    kind: "instance",
    key: invalid ? "label-invalid" : "label",
    of: LABEL,
    cell: (outer) => ({ state: outer.state === "disabled" ? "disabled" : "rest" }),
    properties: () => ({ text: { Label: text } }),
    facts: new Map([["data-invalid", () => invalid]]),
    shownIn: (cell) => isInvalid(cell) === invalid,
    exposed: true,
  };
}

/**
 * FieldFrame's heading row, a bare `<div>`, holding the label and the parts a composite adds after
 * it. The row fills the column and packs its children with `justify-between`.
 *
 * @param label - The label's characters.
 * @param classes - The row's classes: FieldFrame's, with a composite's own merged after them.
 * @param after - The parts after the label, such as Textarea field's counter.
 * @returns The row part.
 */
export function frameLabelRow(
  label: string,
  classes: string,
  after: readonly PartDefinition[] = []
): PartDefinition {
  return {
    key: "label-row",
    slot: undefined,
    // A bare `<div>`, found by its classes, since a composite's content wrapper is one too.
    element: { tag: "div", attributes: { class: classes } },
    shownIn: always,
    classesFor: () => classes,
    label: undefined,
    iconsFor: () => [],
    parts: [frameLabel(label, false), frameLabel(label, true), ...after],
  };
}

/**
 * The error under the control, a `Field error` instance, which only an invalid Field renders.
 *
 * @param text - The error's characters, set through the instance's `Text` property.
 * @returns The instance part.
 */
export function frameError(text: string): InstanceDefinition {
  return {
    kind: "instance",
    key: "error",
    of: FIELD_ERROR,
    cell: () => ({ state: "invalid" }),
    properties: () => ({ text: { Text: text } }),
    shownIn: isInvalid,
    exposed: true,
  };
}

/** The Field state Base UI stamps on the description: none, `data-disabled` or `data-invalid`. */
type DescriptionStamp = "none" | "disabled" | "invalid";

/** The stamp a cell's Field puts on its description. */
function stampOf(cell: Cell): DescriptionStamp {
  return cell.state === "disabled" || cell.state === "invalid" ? cell.state : "none";
}

/** The description for one stamp, with the classes FieldFrame gives it. */
function frameDescription(text: string, stamp: DescriptionStamp, classes: string): InstanceDefinition {
  return {
    kind: "instance",
    key: stamp === "none" ? "description" : `description-${stamp}`,
    of: FIELD_DESCRIPTION,
    cell: () => ({ state: "rest" }),
    classesFor: () => classes,
    properties: () => ({ text: { Text: text } }),
    facts: new Map([
      ["data-disabled", () => stamp === "disabled"],
      ["data-invalid", () => stamp === "invalid"],
    ]),
    shownIn: (cell) => stampOf(cell) === stamp,
    exposed: true,
  };
}

/**
 * The description, a `Field description` instance per stamp: after the control, or under a legend.
 *
 * @param text - The description's characters, set through the instance's `Text` property.
 * @param classes - The classes FieldFrame gives it, its `text-pretty` after a control by default.
 * @returns The instance parts, one of which each cell shows.
 */
export function frameDescriptions(
  text: string,
  classes: string = frame.description()
): readonly InstanceDefinition[] {
  return [
    frameDescription(text, "none", classes),
    frameDescription(text, "disabled", classes),
    frameDescription(text, "invalid", classes),
  ];
}

/**
 * The variant a Field composite's root renders when disabled: it is the `group/field` a disabled
 * Field marks `data-disabled`, which the label reads.
 */
export const FIELD_FRAME_DISABLED = ["group-data-disabled/field"] as const;

/** The Field root's child selectors, which the composite omits with their reasons. */
export const FIELD_FRAME_OMISSIONS: ReadonlyMap<string, string> = new Map([
  FIELD_ROOT_SR_ONLY,
  [
    FIELD_ROOT_STRETCH,
    "the Field stretches each child to its width, which the column's stretch already gives them",
  ],
]);

/**
 * The fields every Field composite spreads: the `Field.Root` column, as wide as the field box's
 * preview, its states in columns, and no label, icon or swap of its own. A composite sets its own
 * `rootKind`, axes, states, facts and parts, and its own classes where it merges more onto the root's.
 */
export const FIELD_FRAME_SET: Pick<
  ComponentDefinition,
  | "rootOverflow"
  | "slot"
  | "previewWidth"
  | "columnAxis"
  | "classesFor"
  | "omittedStates"
  | "omittedCompositions"
  | "label"
  | "iconsFor"
  | "swapProperties"
> = {
  // CSS leaves the root unclipped, so a ring a layer draws at its edge shows past it (compare-real-1).
  rootOverflow: "visible",
  slot: "field",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  columnAxis: "state",
  classesFor: () => fieldVariants().root(),
  omittedStates: new Set(),
  omittedCompositions: FIELD_FRAME_OMISSIONS,
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};
