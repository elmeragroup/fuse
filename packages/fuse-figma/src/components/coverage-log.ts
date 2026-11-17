/**
 * Who owns a declaration's coverage rows, and where a row goes: to the origin that owns its
 * declaration, unless an instance part built in place holds the layer that reads it and the inner
 * component does not own it, which leaves the row for the instance's diff to settle.
 */
import type { InPlace, Recorder } from "./layer-style";

/**
 * Who owns the coverage rows of a declaration: the set whose box holds its class, or, for an instance
 * part built in place, the inner component or the outer component that passes it the class. A row
 * goes to its owner's recorder, except where `InPlace` takes a composite's row first.
 */
export type Origin = { readonly record: Recorder };

/**
 * Where a row goes: to the origin that owns its declaration, unless an instance part built in place
 * holds the layer and its inner component does not own the declaration, which leaves a composite's
 * row for the instance's diff to settle.
 *
 * @param inPlace - The instance part built in place that holds the layer that reads the declaration,
 *   undefined for a layer of the set's own boxes.
 * @param origin - The declaration's owner.
 * @returns The recorder of the row.
 */
export function routed(inPlace: InPlace | undefined, origin: Origin): Recorder {
  return inPlace === undefined || origin === inPlace.inner
    ? origin.record
    : (row) => {
        inPlace.composite(row, origin);
      };
}
