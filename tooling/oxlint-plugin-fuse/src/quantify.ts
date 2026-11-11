import type { Alt } from "./resolve.ts";

/*
 * The one rule every consumer applies to a value's alternatives. A value the evaluator cannot
 * know (`unknown`) is never evidence for an exemption.
 */

/**
 * Whether a value is a violation: any one of its alternatives violates.
 *
 * @param alternatives - Every value the expression may hold, or one reading per alternative (a
 *   name, a spelling).
 * @param violates - Whether one alternative violates.
 * @returns Whether the value violates.
 */
export function anyViolates<T>(
  alternatives: ReadonlyArray<T>,
  violates: (alternative: T) => boolean
): boolean {
  return alternatives.some((alternative) => violates(alternative));
}

/**
 * Whether a value earns an exemption: it has alternatives, none is `unknown`, and every one
 * qualifies.
 *
 * @param alternatives - Every value the expression may hold.
 * @param qualifies - Whether one alternative qualifies.
 * @returns Whether the value is exempt.
 */
export function allQualify(
  alternatives: ReadonlyArray<Alt>,
  qualifies: (alternative: Alt) => boolean
): boolean {
  return (
    alternatives.length > 0 &&
    alternatives.every((alternative) => alternative.kind !== "unknown" && qualifies(alternative))
  );
}
