/**
 * Tailwind class parsing for the class-string tests: the class tokens a module's code holds, and a
 * token's variants and utility.
 */

/**
 * The class tokens in source code: every run between whitespace, quotes and backticks.
 *
 * @param code - A module's code.
 * @returns The runs in source order.
 */
export function classTokens(code: string): string[] {
  return code.split(/[\s"'`]+/u).filter((token) => token.length > 0);
}

/** A class token split at the colons outside brackets. */
type SplitToken = {
  /** The variants before the utility, such as `hover` and `data-open`. */
  readonly variants: readonly string[];

  /** The utility after the last variant. */
  readonly utility: string;
};

/** The change a character makes to the bracket and parenthesis depth of a class token. */
function depthStep(character: string): number {
  if (character === "[" || character === "(") return 1;
  if (character === "]" || character === ")") return -1;
  return 0;
}

/** A class token's parts between each `separator` outside brackets and parentheses. */
function splitTopLevel(token: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of token) {
    depth += depthStep(character);
    if (character === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  return [...parts, current];
}

/**
 * Split a class token into its variants and utility at the colons outside brackets and
 * parentheses, so the type hint in `text-(color:--x)` stays in the utility.
 *
 * @param token - One class token.
 * @returns Its variants and utility.
 */
export function splitVariants(token: string): SplitToken {
  const parts = splitTopLevel(token, ":");
  return { variants: parts.slice(0, -1), utility: parts.at(-1) ?? "" };
}
