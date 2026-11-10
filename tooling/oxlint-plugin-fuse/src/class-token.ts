/** A Tailwind class split at the colons outside brackets and parentheses. */
export type ClassToken = {
  /** The variants before the utility, such as `hover` and `data-open`. */
  readonly variants: readonly string[];
  /** The utility after the last variant. */
  readonly utility: string;
};

/**
 * The classes a class string holds.
 *
 * @param text - A class string.
 * @returns Its whitespace-separated classes.
 */
export function classesOf(text: string): string[] {
  return text.split(/\s+/u).filter((token) => token.length > 0);
}

/**
 * Splits a class at the colons outside brackets and parentheses, so an arbitrary variant such as
 * `has-[[data-slot=x]:disabled]` stays one variant.
 *
 * @param token - One class.
 * @returns Its variants and its utility.
 */
export function parseClass(token: string): ClassToken {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of token) {
    if (character === "[" || character === "(") depth += 1;
    if (character === "]" || character === ")") depth -= 1;
    if (character === ":" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  return { variants: parts, utility: current };
}
