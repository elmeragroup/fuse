"use client";

/**
 * The sentence a reference speaks, which the cartesian and the clock references share. It lives in a
 * light leaf, so the clock route takes it without importing the cartesian Root.
 */
import type { FormattedText } from "./format/formatted-text";

/**
 * Fill `{value}` in a label, or join the label and the value, or use the dictionary's pattern.
 *
 * @param label - The reference's label, if it has one.
 * @param value - The reference's value or range.
 * @param pattern - The dictionary's sentence for a reference with no label.
 * @returns The visible label's text and the sentence readers hear.
 */
export function referenceSentence(
  label: string | undefined,
  value: FormattedText,
  pattern: (value: string) => string
): FormattedText {
  if (label === undefined) return { text: pattern(value.text), spoken: pattern(value.spoken) };
  if (label.includes("{value}")) {
    return {
      text: label.replaceAll("{value}", value.text),
      spoken: label.replaceAll("{value}", value.spoken),
    };
  }
  return { text: label, spoken: `${label}: ${value.spoken}` };
}
