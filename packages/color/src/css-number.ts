/**
 * The CSS number grammar the functional-notation parsers share.
 */

import { clampToUnitInterval } from "./component-range.ts";

/**
 * A CSS Syntax 3 `<number-token>`: an optional sign, digits with an optional fraction, and
 * an optional exponent. The two-branch alternation stays linear on a long digit run that
 * fails to match, where the shorter `\d*\.?\d+` backtracks quadratically.
 */
export const CSS_NUMBER = "[+-]?(?:\\d*\\.\\d+|\\d+)(?:[eE][+-]?\\d+)?";

/**
 * Read an alpha, clamped to `0..1` as CSS clamps it at parse time. The text matched
 * {@link CSS_NUMBER}, so it is a number; an exponent too large for a double reads as
 * infinity and clamps to an end.
 *
 * @param value - The matched number text, or `undefined` when the color wrote no alpha.
 * @param percent - The matched `%` suffix, for a notation that accepts a percentage alpha.
 * @returns The alpha in `0..1`, and `1` when the color wrote none.
 */
export function readAlpha(value: string | undefined, percent?: string): number {
  if (value === undefined) {
    return 1;
  }
  return clampToUnitInterval(Number(value) / (percent === "%" ? 100 : 1));
}
