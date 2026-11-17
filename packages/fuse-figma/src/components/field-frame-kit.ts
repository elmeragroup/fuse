/**
 * What the Field composites' manifests share, as Fuse's FieldFrame renders them: a `Field.Root`
 * column holding a heading row with the label, the control, the error in an invalid Field and the
 * description. Text field, Textarea field, Select field, Number field and Radio group read their
 * parts from here.
 *
 * - The label, the error and the description are instances of `Label`, `Field error` and `Field
 *   description`, each exposed so a designer sets its text from the composite.
 * - Base UI stamps the Field's state on the label and the description as data attributes: a
 *   disabled Field marks them `data-disabled`, an invalid one `data-invalid`. The label and the
 *   description are one layer each, and the build carries what a stamp draws differently as that
 *   cell's overrides.
 */
import type { InstanceManifest, PartManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { FIELD_DESCRIPTION_MANIFEST, FIELD_ERROR_MANIFEST } from "./field-text-kit";
import { LABEL_MANIFEST } from "./label-kit";
import { always } from "./popup-facts";

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
 * A field frame's label row as a manifest names it, at its place below the Field root, holding the
 * label, at rest or disabled as the Field is.
 *
 * @param label - The label's text.
 * @param place - The row's place, such as `field/0`.
 * @param after - The parts the row holds after the label, as Textarea field's counter.
 * @returns The row.
 */
export function frameLabelRowManifest(
  label: string,
  place: string,
  after: readonly PartManifest[] = []
): PartManifest {
  const labelPart: InstanceManifest = {
    kind: "instance",
    key: "label",
    of: LABEL_MANIFEST,
    cell: (outer) => ({ state: outer.state === "disabled" ? "disabled" : "rest" }),
    properties: () => ({ text: { Label: label } }),
    shownIn: always,
    exposed: true,
  };
  return {
    key: "label-row",
    slot: undefined,
    place,
    shownIn: always,
    label: undefined,
    iconsFor: () => [],
    parts: [labelPart, ...after],
  };
}

/**
 * A field frame's error as a manifest names it, shown in an invalid cell.
 *
 * @param error - The error's text.
 * @returns The error.
 */
export function frameErrorManifest(error: string): InstanceManifest {
  return {
    kind: "instance",
    key: "error",
    of: FIELD_ERROR_MANIFEST,
    cell: () => ({ state: "invalid" }),
    properties: () => ({ text: { Text: error } }),
    shownIn: isInvalid,
    exposed: true,
  };
}

/**
 * A field frame's description as a manifest names it, in every cell.
 *
 * @param description - The description's text.
 * @returns The description.
 */
export function frameDescriptionManifest(description: string): InstanceManifest {
  return {
    kind: "instance",
    key: "description",
    of: FIELD_DESCRIPTION_MANIFEST,
    cell: () => ({ state: "rest" }),
    properties: () => ({ text: { Text: description } }),
    shownIn: always,
    exposed: true,
  };
}

/**
 * A field frame's error and its description as a manifest names them, after its control.
 *
 * @param error - The error's text.
 * @param description - The description's text.
 * @returns The error, then the description.
 */
export function frameMessagesManifest(error: string, description: string): readonly InstanceManifest[] {
  return [frameErrorManifest(error), frameDescriptionManifest(description)];
}
