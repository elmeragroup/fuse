/**
 * Lengths that scale with the text they sit under. `css-values.ts` evaluates a length on its own,
 * and an `em` needs the element's font size besides.
 */

import { evaluateLength, normalizeCss } from "./css-values";

/** An `em` length literal, its number in the first group. */
const EM_LITERAL = /([+-]?(?:\d+\.?\d*|\.\d+))em\b/g;

/**
 * Evaluate a length in pixels whose `em` takes a known font size, as Link's underline offset and
 * thickness scale with the text they sit under.
 *
 * @param value - A CSS value with no `var()` left in it.
 * @param fontSize - The element's font size in pixels, which `1em` stands for.
 * @returns The pixels, or undefined for anything {@link evaluateLength} does not evaluate.
 */
export function evaluateLengthInFont(value: string, fontSize: number): number | undefined {
  return evaluateLength(
    normalizeCss(value).replaceAll(EM_LITERAL, (_match, number: string) => `${Number(number) * fontSize}px`)
  );
}
